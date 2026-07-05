"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma, Role } from "@/generated/prisma/client";
import { ForbiddenError, requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * Server actions for the Admin panel (PLAN.md §9.8, §7 security model,
 * §17 last-admin _RISK_).
 *
 * `setUserRole` is the ONLY mutation in this file (Phase 10 scope is
 * read-only user listing + role changes). Every call:
 *  - calls requireAdmin() FIRST — a non-admin (or unauthenticated) caller
 *    is rejected before any DB read/write happens. Identity (who is
 *    performing the change) comes ONLY from the verified session, never
 *    from a client-supplied "actor" field.
 *  - validates `newRole` against the Role enum via Zod (a client sending
 *    something outside {USER, ADMIN} is rejected).
 *  - validates the target user exists.
 *  - enforces the LAST-ADMIN GUARD atomically inside a Serializable
 *    transaction (see setUserRole's doc comment below for the race
 *    analysis) so the number of admins can never reach zero, whether the
 *    admin is demoting someone else or demoting themselves.
 *  - RE-VERIFIES THE ACTING ADMIN INSIDE THE SAME TRANSACTION (§17 JWT
 *    staleness hardening, Phase 11) — see the doc comment on setUserRole
 *    below for why this belt-and-suspenders check exists alongside
 *    requireAdmin()'s own DB re-check.
 */

export type AdminActionResult =
  | { ok: true }
  | { ok: false; error: string };

const setUserRoleSchema = z.object({
  targetUserId: z.string().trim().min(1, { error: "A target user is required." }),
  newRole: z.enum(Role, { error: "Please choose a valid role." }),
});

/**
 * Promote/demote a user's role. Only an ADMIN may call this.
 *
 * THE CRITICAL GUARD (last-admin protection, §9.8 / §17):
 * If the target is currently ADMIN and `newRole` is USER, the change is
 * only allowed if there is currently MORE THAN ONE admin. If the target is
 * the last admin (admin count === 1), the change is rejected — this covers
 * both "cannot remove the last admin" and "cannot demote self if last
 * admin" (self-demotion by the sole admin is the same case: target ==
 * acting admin, admin count == 1).
 *
 * Promotions (USER -> ADMIN) and no-op same-role sets never reduce the
 * admin count, so they need no guard and are always allowed for an admin
 * caller.
 *
 * ATOMICITY / RACE ANALYSIS:
 * A naive `prisma.user.count({ where: { role: "ADMIN" } })` followed by a
 * separate `prisma.user.update(...)` has a TOCTOU race: two concurrent
 * demotion requests (e.g. admin A demotes admin B, and admin B
 * simultaneously demotes admin A, while a third admin C is NOT involved —
 * or more simply, two admins each try to demote the other of a two-admin
 * pair at the same instant) could each run `count()` and both see 2 admins
 * before either `update()` commits, and both proceed, leaving 0 admins.
 *
 * Fix: the count-check-then-update is wrapped in a single
 * `prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })`.
 * Under Postgres SERIALIZABLE, if two concurrent transactions both read the
 * admin count and then one of them writes in a way that would violate the
 * serial ordering implied by the other's read, Postgres aborts one of them
 * with a serialization failure (SQLSTATE 40001) rather than letting both
 * commit. Concretely: with exactly 2 admins, if two concurrent
 * transactions both count() -> 2 -> decide "allowed" -> update one admin
 * to USER each, the second transaction to commit will conflict on the
 * User row(s) it read (the admin-count query reads all ADMIN rows) and
 * Postgres will roll it back; the caller sees a thrown error, which we
 * catch and translate into a clean `{ ok: false }` retry-able result. That
 * guarantees the admin count can never be driven to 0 by concurrent
 * demotions.
 *
 * Residual race (honest disclosure): Serializable transactions in Postgres
 * can raise serialization failures that must be retried by the caller;
 * this action does NOT automatically retry — it surfaces the failure as
 * `{ ok: false, error: "..." }` so the admin can simply click again. For a
 * local single-admin-console app this is an acceptable UX tradeoff (no
 * silent data corruption, just an occasional "try again" on genuine
 * concurrent conflict, which is very unlikely in practice for this app).
 *
 * ACTING-ADMIN RE-VERIFICATION (§17 JWT staleness hardening, Phase 11):
 * `requireAdmin()` already re-checks the caller against the DB (see its doc
 * comment in lib/permissions.ts), but that check happens BEFORE this
 * transaction opens. Between "requireAdmin() confirmed session.user.id is
 * still ADMIN" and "this transaction commits the role change," the acting
 * admin's own row could theoretically change (e.g. a second admin demotes
 * them in an overlapping request). To make the guarantee atomic rather than
 * just "checked a moment ago," we ALSO re-read the acting user's row by
 * `session.user.id` INSIDE the same Serializable transaction that performs
 * the mutation, and abort with a clean `{ ok: false }` if that row is
 * missing or no longer ADMIN. This is belt-and-suspenders: requireAdmin()
 * closes the common case cheaply outside the transaction; this closes the
 * narrow race window atomically.
 */
export async function setUserRole(
  targetUserId: string,
  newRole: Role
): Promise<AdminActionResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, error: "You do not have permission to change user roles." };
    }
    throw error;
  }

  const parsed = setUserRoleSchema.safeParse({ targetUserId, newRole });
  if (!parsed.success) {
    return { ok: false, error: "Invalid request." };
  }

  const { targetUserId: validTargetId, newRole: validNewRole } = parsed.data;
  const actingUserId = session.user.id;

  try {
    await prisma.$transaction(
      async (tx) => {
        // Belt-and-suspenders re-check of the ACTING admin, atomic with the
        // mutation below (see doc comment above). requireAdmin() already
        // checked this a moment ago, outside the transaction; this closes
        // the race window between that check and the commit.
        const actingUser = await tx.user.findUnique({
          where: { id: actingUserId },
          select: { role: true },
        });

        if (!actingUser || actingUser.role !== Role.ADMIN) {
          throw new ActingUserNotAdminError();
        }

        const target = await tx.user.findUnique({
          where: { id: validTargetId },
          select: { id: true, role: true },
        });

        if (!target) {
          throw new UserNotFoundError();
        }

        // No-op: setting the same role. Nothing to guard, nothing to do.
        if (target.role === validNewRole) {
          return;
        }

        // Demotion path: target is currently ADMIN and is being set to USER.
        // This is the ONLY direction that can reduce the admin count, so
        // it's the only direction that needs the last-admin guard.
        if (target.role === Role.ADMIN && validNewRole === Role.USER) {
          const adminCount = await tx.user.count({ where: { role: Role.ADMIN } });
          if (adminCount <= 1) {
            throw new LastAdminError();
          }
        }

        await tx.user.update({
          where: { id: target.id },
          data: { role: validNewRole },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof ActingUserNotAdminError) {
      return { ok: false, error: "You do not have permission to change user roles." };
    }
    if (error instanceof UserNotFoundError) {
      return { ok: false, error: "That user no longer exists." };
    }
    if (error instanceof LastAdminError) {
      return { ok: false, error: "You can't remove the last admin." };
    }
    // Postgres serialization failure under concurrent conflicting
    // demotions (SQLSTATE 40001) surfaces here as a generic Prisma error;
    // translate it into a clean, retry-able message rather than a 500.
    if (isSerializationFailure(error)) {
      return {
        ok: false,
        error: "That change conflicted with another update. Please try again.",
      };
    }
    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");

  return { ok: true };
}

class UserNotFoundError extends Error {
  constructor() {
    super("User not found.");
    this.name = "UserNotFoundError";
  }
}

class ActingUserNotAdminError extends Error {
  constructor() {
    super("Acting user is no longer an admin.");
    this.name = "ActingUserNotAdminError";
  }
}

class LastAdminError extends Error {
  constructor() {
    super("You can't remove the last admin.");
    this.name = "LastAdminError";
  }
}

function isSerializationFailure(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    // P2034: "Transaction failed due to a write conflict or a deadlock.
    // Please retry your transaction" — Prisma's mapping of Postgres
    // serialization failures (40001) / deadlocks for interactive
    // transactions.
    error.code === "P2034"
  );
}
