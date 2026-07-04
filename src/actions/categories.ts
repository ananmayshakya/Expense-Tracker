"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { assertOwnerOrAdmin, ForbiddenError, requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validations";

/**
 * Server actions for Category CRUD (PLAN.md §9.3, §7 security model).
 *
 * Every action:
 *  - calls requireSession() first and derives identity ONLY from the session
 *  - validates input with the shared Zod schema (never trusts client shape)
 *  - for update/delete: fetches the existing row, then calls
 *    assertOwnerOrAdmin(existing.userId, session) BEFORE mutating
 *  - handles the @@unique([userId, name]) violation (P2002) as a friendly
 *    error instead of a 500
 *  - revalidates the categories page after a successful mutation
 *  - returns a typed, client-safe result (no raw DB records / internals)
 */

export type CategoryActionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      fieldErrors?: Partial<Record<"name" | "color", string[]>>;
    };

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

export async function createCategory(input: {
  name: string;
  color: string;
}): Promise<CategoryActionResult> {
  const session = await requireSession();

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await prisma.category.create({
      data: {
        name: parsed.data.name,
        color: parsed.data.color,
        // userId is ALWAYS derived from the session — never from client input.
        userId: session.user.id,
      },
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return {
        ok: false,
        error: "You already have a category with that name.",
        fieldErrors: { name: ["You already have a category with that name."] },
      };
    }
    throw error;
  }

  revalidatePath("/categories");
  return { ok: true };
}

export async function updateCategory(
  id: string,
  input: { name: string; color: string }
): Promise<CategoryActionResult> {
  const session = await requireSession();

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, error: "Category not found." };
  }

  try {
    assertOwnerOrAdmin(existing.userId, session);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, error: "You do not have access to this category." };
    }
    throw error;
  }

  try {
    await prisma.category.update({
      where: { id },
      data: {
        name: parsed.data.name,
        color: parsed.data.color,
      },
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return {
        ok: false,
        error: "You already have a category with that name.",
        fieldErrors: { name: ["You already have a category with that name."] },
      };
    }
    throw error;
  }

  revalidatePath("/categories");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<CategoryActionResult> {
  const session = await requireSession();

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, error: "Category not found." };
  }

  try {
    assertOwnerOrAdmin(existing.userId, session);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, error: "You do not have access to this category." };
    }
    throw error;
  }

  // Expense/RecurringExpense onDelete: SetNull (Uncategorized); Budget
  // onDelete: Cascade — this is intended schema behavior (PLAN.md §6),
  // enforced by Postgres itself, not application code.
  await prisma.category.delete({ where: { id } });

  revalidatePath("/categories");
  return { ok: true };
}
