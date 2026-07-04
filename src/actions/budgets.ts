"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { parseDecimalInput } from "@/lib/money";
import { assertOwnerOrAdmin, ForbiddenError, requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { budgetSchema } from "@/lib/validations";

/**
 * Server actions for Budget create/update ("set") + delete (PLAN.md §9.5,
 * §7 security model, §10 money discipline, §6 overall-budget NULL-
 * uniqueness _RISK_).
 *
 * Every action:
 *  - calls requireSession() first and derives identity ONLY from the
 *    session (never a client-supplied userId)
 *  - validates input with the shared Zod schema (never trusts client shape)
 *  - for delete: fetches the existing row, then calls
 *    assertOwnerOrAdmin(existing.userId, session) BEFORE mutating
 *  - for a non-null categoryId: verifies the category exists AND belongs
 *    to the correct user before attaching it (mirrors
 *    `assertCategoryOwnership` in src/actions/expenses.ts)
 *  - revalidates the budgets page AND the dashboard (which also surfaces
 *    budget status) after a successful mutation
 *  - returns a typed, client-safe result (no raw DB records / internals)
 *
 * Semantics: setting a budget for a given (month, year, category-or-
 * overall) is an UPSERT — if one already exists for that key, its amount
 * is updated; otherwise a new row is created. There is no separate
 * "create" vs "update" entry point from the caller's perspective; the
 * form always calls `setBudget`.
 */

export type BudgetActionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      fieldErrors?: Partial<Record<"amount" | "month" | "year" | "categoryId", string[]>>;
    };

export type BudgetInputRaw = {
  amount: string | number;
  month: string | number;
  year: string | number;
  categoryId?: string | null;
};

/**
 * Verifies `categoryId` (if non-null) refers to a category owned by
 * `userId`. Mirrors `assertCategoryOwnership` in `src/actions/expenses.ts`
 * — without this check, a user (or an admin acting on a user's behalf)
 * could attach ANOTHER user's categoryId to a budget.
 */
async function assertCategoryOwnership(
  categoryId: string | null | undefined,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (categoryId === null || categoryId === undefined) {
    return { ok: true };
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { userId: true },
  });

  if (!category || category.userId !== userId) {
    return { ok: false, error: "That category does not exist or is not yours." };
  }

  return { ok: true };
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function revalidateBudgetPages() {
  revalidatePath("/budgets");
  // The dashboard surfaces overall budget status for the current month
  // (PLAN.md §9.4 / Phase 6 scope C), so it must be revalidated too.
  revalidatePath("/dashboard");
}

/**
 * Create-or-update a budget for (userId, categoryId, month, year).
 *
 * - Per-category budgets (categoryId non-null): the DB `@@unique([userId,
 *   categoryId, month, year])` applies cleanly here since categoryId is a
 *   concrete value, so we `create` and translate a P2002 into an `update`
 *   (equivalent to an upsert, but avoids relying on Prisma's `upsert` need
 *   for a literal compound-unique input shape with a nullable field).
 * - Overall budgets (categoryId null): THE CRITICAL RISK from PLAN.md §6 —
 *   Postgres treats NULL as distinct in a unique index, so the DB
 *   constraint does NOT prevent duplicate overall-budget rows. We do NOT
 *   rely on `@@unique` here. Instead we explicitly find-or-create inside a
 *   `prisma.$transaction` to shrink the TOCTOU race window: find the
 *   existing overall row for (userId, month, year); if found, update it;
 *   if not, create it. This guarantees at most one overall budget per
 *   (userId, month, year) at the application level.
 */
export async function setBudget(input: BudgetInputRaw): Promise<BudgetActionResult> {
  const session = await requireSession();

  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const categoryId = parsed.data.categoryId ?? null;
  const ownershipCheck = await assertCategoryOwnership(categoryId, session.user.id);
  if (!ownershipCheck.ok) {
    return {
      ok: false,
      error: ownershipCheck.error,
      fieldErrors: { categoryId: [ownershipCheck.error] },
    };
  }

  let amount: Prisma.Decimal;
  try {
    amount = parseDecimalInput(parsed.data.amount);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid amount.";
    return { ok: false, error: message, fieldErrors: { amount: [message] } };
  }

  const { month, year } = parsed.data;
  const userId = session.user.id;

  if (categoryId === null) {
    // Overall budget: app-level find-or-create, wrapped in a transaction
    // to shrink the TOCTOU window (PLAN.md §6 _RISK_ — the DB unique
    // constraint does not help here because Postgres treats NULL as
    // distinct in `@@unique([userId, categoryId, month, year])`).
    await prisma.$transaction(async (tx) => {
      const existing = await tx.budget.findFirst({
        where: { userId, categoryId: null, month, year },
        select: { id: true },
      });

      if (existing) {
        await tx.budget.update({
          where: { id: existing.id },
          data: { amount },
        });
      } else {
        await tx.budget.create({
          data: { userId, categoryId: null, month, year, amount },
        });
      }
    });
  } else {
    // Per-category budget: the DB compound unique key
    // (userId, categoryId, month, year) is fully non-null here, so it
    // applies as intended. Create first; on a duplicate (P2002), update
    // the existing row instead — this is the upsert semantics described
    // in the phase brief ("budget already exists -> updates it", not an
    // error).
    try {
      await prisma.budget.create({
        data: { userId, categoryId, month, year, amount },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        await prisma.budget.updateMany({
          where: { userId, categoryId, month, year },
          data: { amount },
        });
      } else {
        throw error;
      }
    }
  }

  revalidateBudgetPages();
  return { ok: true };
}

export async function deleteBudget(id: string): Promise<BudgetActionResult> {
  const session = await requireSession();

  const existing = await prisma.budget.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, error: "Budget not found." };
  }

  try {
    assertOwnerOrAdmin(existing.userId, session);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, error: "You do not have access to this budget." };
    }
    throw error;
  }

  await prisma.budget.delete({ where: { id } });

  revalidateBudgetPages();
  return { ok: true };
}
