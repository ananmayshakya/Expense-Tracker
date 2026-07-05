"use server";

import { revalidatePath } from "next/cache";

import { Prisma, RecurrenceFrequency } from "@/generated/prisma/client";
import { parseDecimalInput } from "@/lib/money";
import { assertOwnerOrAdmin, ForbiddenError, requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { processDueRecurring } from "@/lib/recurrence";
import { recurringSchema } from "@/lib/validations";

/**
 * Server actions for RecurringExpense CRUD + manual "Run now" (PLAN.md
 * §9.6, §7 security model, §10 money discipline).
 *
 * Every action:
 *  - calls requireSession() first and derives identity ONLY from the
 *    session (never a client-supplied userId)
 *  - validates input with the shared Zod schema (never trusts client shape)
 *  - for update/delete: fetches the existing row, then calls
 *    assertOwnerOrAdmin(existing.userId, session) BEFORE mutating
 *  - for a non-null categoryId: verifies the category exists AND belongs
 *    to the correct user before attaching it (mirrors
 *    `assertCategoryOwnership` in src/actions/expenses.ts / budgets.ts)
 *  - revalidates /recurring (and, for runRecurringNow, /expenses and
 *    /dashboard, since materialization creates real Expense rows and
 *    changes dashboard aggregates) after a successful mutation
 *  - returns a typed, client-safe result (no raw DB records / internals)
 */

export type RecurringActionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      fieldErrors?: Partial<
        Record<"amount" | "description" | "frequency" | "nextRunDate" | "categoryId", string[]>
      >;
    };

export type RunRecurringNowResult =
  | { ok: true; expensesCreated: number; rowsProcessed: number }
  | { ok: false; error: string };

export type RecurringInputRaw = {
  amount: string | number;
  description: string;
  frequency: RecurrenceFrequency;
  nextRunDate: string | Date;
  active?: boolean;
  categoryId?: string | null;
};

/**
 * Verifies `categoryId` (if non-null) refers to a category owned by
 * `userId`. Mirrors `assertCategoryOwnership` in `src/actions/expenses.ts`
 * / `src/actions/budgets.ts` — without this check, a user (or an admin
 * acting on a user's behalf) could attach ANOTHER user's categoryId to a
 * recurring expense.
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

function revalidateRecurringPages() {
  revalidatePath("/recurring");
}

/** Also revalidates /expenses and /dashboard — used after materialization
 * (runRecurringNow), which creates real Expense rows and changes dashboard
 * aggregates, unlike plain CRUD on the recurring definition itself. */
function revalidateAfterMaterialization() {
  revalidatePath("/recurring");
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

export async function createRecurring(input: RecurringInputRaw): Promise<RecurringActionResult> {
  const session = await requireSession();

  const parsed = recurringSchema.safeParse(input);
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

  await prisma.recurringExpense.create({
    data: {
      amount,
      description: parsed.data.description,
      frequency: parsed.data.frequency,
      nextRunDate: parsed.data.nextRunDate,
      active: parsed.data.active,
      categoryId,
      // userId is ALWAYS derived from the session — never from client input.
      userId: session.user.id,
    },
  });

  revalidateRecurringPages();
  return { ok: true };
}

export async function updateRecurring(
  id: string,
  input: RecurringInputRaw
): Promise<RecurringActionResult> {
  const session = await requireSession();

  const parsed = recurringSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const existing = await prisma.recurringExpense.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, error: "Recurring expense not found." };
  }

  try {
    assertOwnerOrAdmin(existing.userId, session);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, error: "You do not have access to this recurring expense." };
    }
    throw error;
  }

  const categoryId = parsed.data.categoryId ?? null;
  // Ownership check uses the ROW's owner (existing.userId), not the
  // caller's id — mirrors expenses.ts/budgets.ts: an admin editing another
  // user's recurring expense must attach a category owned by that same
  // user (the row's owner), never the admin's own category.
  const ownershipCheck = await assertCategoryOwnership(categoryId, existing.userId);
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

  await prisma.recurringExpense.update({
    where: { id },
    data: {
      amount,
      description: parsed.data.description,
      frequency: parsed.data.frequency,
      nextRunDate: parsed.data.nextRunDate,
      active: parsed.data.active,
      categoryId,
    },
  });

  revalidateRecurringPages();
  return { ok: true };
}

export async function deleteRecurring(id: string): Promise<RecurringActionResult> {
  const session = await requireSession();

  const existing = await prisma.recurringExpense.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, error: "Recurring expense not found." };
  }

  try {
    assertOwnerOrAdmin(existing.userId, session);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, error: "You do not have access to this recurring expense." };
    }
    throw error;
  }

  await prisma.recurringExpense.delete({ where: { id } });

  revalidateRecurringPages();
  return { ok: true };
}

/**
 * Toggles the `active` flag on a recurring expense (§9.6 "active toggle").
 * Same ownership gate as update/delete; does NOT re-validate the rest of
 * the row's fields since it changes exactly one boolean.
 */
export async function setRecurringActive(
  id: string,
  active: boolean
): Promise<RecurringActionResult> {
  const session = await requireSession();

  const existing = await prisma.recurringExpense.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, error: "Recurring expense not found." };
  }

  try {
    assertOwnerOrAdmin(existing.userId, session);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, error: "You do not have access to this recurring expense." };
    }
    throw error;
  }

  await prisma.recurringExpense.update({
    where: { id },
    data: { active },
  });

  revalidateRecurringPages();
  return { ok: true };
}

/**
 * Manual "Run now" (§9.6). SECURITY: this is the ONLY client-callable entry
 * point into `processDueRecurring`, and it derives `userId` strictly from
 * `requireSession()` — there is no way for a client to pass a different
 * userId in. A caller can only ever materialize their OWN recurring rows.
 */
export async function runRecurringNow(): Promise<RunRecurringNowResult> {
  const session = await requireSession();

  const result = await processDueRecurring(session.user.id);

  revalidateAfterMaterialization();
  return { ok: true, expensesCreated: result.expensesCreated, rowsProcessed: result.rowsProcessed };
}
