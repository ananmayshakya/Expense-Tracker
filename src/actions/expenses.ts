"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { parseDecimalInput } from "@/lib/money";
import { assertOwnerOrAdmin, ForbiddenError, requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { expenseSchema } from "@/lib/validations";

/**
 * Server actions for Expense CRUD (PLAN.md §9.2, §7 security model, §10
 * money discipline).
 *
 * Every action:
 *  - calls requireSession() first and derives identity ONLY from the session
 *  - validates input with the shared Zod schema (never trusts client shape)
 *  - for update/delete: fetches the existing row, then calls
 *    assertOwnerOrAdmin(existing.userId, session) BEFORE mutating
 *  - for create/update with a non-null categoryId: verifies the category
 *    exists AND belongs to the session user before attaching it — this is
 *    the "category-assignment ownership" rule from the phase brief. This
 *    check is done unconditionally (not skipped for admins) because
 *    "attach a category to an expense" is about the CATEGORY's owner, not
 *    the expense's owner.
 *  - revalidates the expenses page after a successful mutation
 *  - returns a typed, client-safe result (no raw DB records / internals)
 */

export type ExpenseActionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      fieldErrors?: Partial<Record<"amount" | "description" | "date" | "categoryId", string[]>>;
    };

export type ExpenseInputRaw = {
  amount: string | number;
  description: string;
  date: string | Date;
  categoryId?: string | null;
};

/**
 * Verifies `categoryId` (if non-null) refers to a category owned by
 * `userId`. This is the ownership hole called out in the phase brief:
 * without this check, a user could attach ANOTHER user's categoryId to
 * their own expense.
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

export async function createExpense(input: ExpenseInputRaw): Promise<ExpenseActionResult> {
  const session = await requireSession();

  const parsed = expenseSchema.safeParse(input);
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
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid amount.",
      fieldErrors: { amount: [error instanceof Error ? error.message : "Invalid amount."] },
    };
  }

  await prisma.expense.create({
    data: {
      amount,
      description: parsed.data.description,
      date: parsed.data.date,
      categoryId,
      // userId is ALWAYS derived from the session — never from client input.
      userId: session.user.id,
    },
  });

  revalidatePath("/expenses");
  return { ok: true };
}

export async function updateExpense(
  id: string,
  input: ExpenseInputRaw
): Promise<ExpenseActionResult> {
  const session = await requireSession();

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, error: "Expense not found." };
  }

  try {
    assertOwnerOrAdmin(existing.userId, session);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, error: "You do not have access to this expense." };
    }
    throw error;
  }

  const categoryId = parsed.data.categoryId ?? null;
  // Ownership check uses the EXPENSE's owner (existing.userId), not the
  // caller's id, so an admin editing another user's expense must attach
  // a category owned by that same user (the expense owner) — never the
  // admin's own category, and never a third user's category.
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
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid amount.",
      fieldErrors: { amount: [error instanceof Error ? error.message : "Invalid amount."] },
    };
  }

  await prisma.expense.update({
    where: { id },
    data: {
      amount,
      description: parsed.data.description,
      date: parsed.data.date,
      categoryId,
    },
  });

  revalidatePath("/expenses");
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<ExpenseActionResult> {
  const session = await requireSession();

  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, error: "Expense not found." };
  }

  try {
    assertOwnerOrAdmin(existing.userId, session);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, error: "You do not have access to this expense." };
    }
    throw error;
  }

  await prisma.expense.delete({ where: { id } });

  revalidatePath("/expenses");
  return { ok: true };
}
