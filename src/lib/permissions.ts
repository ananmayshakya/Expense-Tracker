import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Authorization helpers per PLAN.md §7.
 *
 * The rule: identity is ALWAYS derived from the server-verified session,
 * never from client-supplied input (e.g. a `userId` in a request body).
 */

/**
 * Returns the current session, or redirects to /login if there isn't one.
 * Use in Server Components / layouts / pages that require auth.
 */
export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

/**
 * Requires the current session to belong to an ADMIN. Redirects unauth'd
 * users to /login, and throws a 403 Error for authenticated non-admins
 * (callers in Server Components can let this propagate to an error
 * boundary; Route Handlers should catch and translate to a 403 response).
 *
 * SECURITY (PLAN.md §17 "JWT role/existence staleness", hardened Phase 11):
 * Session strategy is JWT (§2), so `session.user.role` is whatever was baked
 * into the token at last sign-in/refresh — it is NOT re-checked against the
 * DB on every request. That means a JWT alone is not sufficient evidence of
 * current admin status: an admin who gets demoted, or whose account gets
 * deleted, keeps a token that *claims* ADMIN until it naturally expires.
 *
 * To close that hole on the admin surface specifically (this function is
 * the single choke point both admin call sites — the admin page and
 * `setUserRole` — go through), we re-verify the CURRENT DB state after the
 * cheap JWT check: fetch the user by `session.user.id` and require that the
 * row still exists AND its `role` is still `ADMIN`. If either fails
 * (deleted user, or demoted-since-token-issued), treat the caller as a
 * non-admin — same `ForbiddenError` as the stateless check, so callers don't
 * need to distinguish the two cases.
 *
 * This adds one indexed primary-key lookup per admin-surface request, which
 * is an acceptable cost for the two admin call sites. `requireSession()`
 * deliberately does NOT get this treatment (see PLAN.md Phase 11 scope) —
 * hitting the DB on every authenticated page load for the low-risk
 * deleted-user-with-valid-token case is not worth it; only the higher-value
 * admin surface is hardened here.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") {
    throw new ForbiddenError("Admin role required.");
  }

  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!current || current.role !== "ADMIN") {
    throw new ForbiddenError("Admin role required.");
  }

  return session;
}

/**
 * Ownership check used by every mutation/read of a user-owned resource.
 * Allows the resource owner OR an admin; throws otherwise.
 *
 * `resourceUserId` must come from the database record being acted on —
 * NEVER from client input — and `session` must come from `requireSession()`.
 */
export function assertOwnerOrAdmin(resourceUserId: string, session: Session): void {
  const isOwner = session.user.id === resourceUserId;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    throw new ForbiddenError("You do not have access to this resource.");
  }
}

/**
 * Thrown by `requireAdmin` / `assertOwnerOrAdmin` when an authenticated
 * user is not permitted to perform the action. Route Handlers should catch
 * this and respond with 403.
 */
export class ForbiddenError extends Error {
  status = 403 as const;

  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}
