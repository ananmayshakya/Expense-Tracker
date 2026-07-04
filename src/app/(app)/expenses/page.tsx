import type { Prisma } from "@/generated/prisma/client";
import { decimalToString } from "@/lib/money";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { expenseFilterSchema } from "@/lib/validations";

import ExpensesClient from "./ExpensesClient";

type SearchParams = { [key: string]: string | string[] | undefined };

/**
 * Expenses page (§9.2). Server Component: loads ONLY the current user's
 * expenses — never another user's — filtered/sorted server-side via
 * Prisma `where`/`orderBy`, driven by validated URL search params so the
 * view is shareable and testable. Mutations go through the server actions
 * in `src/actions/expenses.ts`, which re-verify ownership (and category
 * ownership) server-side.
 *
 * Amounts are converted to strings (decimalToString) before crossing into
 * the client component — a raw Prisma `Decimal` is not serializable across
 * the RSC -> client boundary (PLAN.md §10).
 */
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const rawParams = await searchParams;

  const filters = expenseFilterSchema.parse({
    categoryIds: toArray(rawParams.categoryIds),
    dateFrom: emptyToUndefined(firstValue(rawParams.dateFrom)),
    dateTo: emptyToUndefined(firstValue(rawParams.dateTo)),
    search: emptyToUndefined(firstValue(rawParams.search)),
    sortBy: emptyToUndefined(firstValue(rawParams.sortBy)) ?? "date",
    sortDir: emptyToUndefined(firstValue(rawParams.sortDir)) ?? "desc",
  });

  // Every clause is scoped to the session user — client-supplied filter
  // params can only narrow this `where`, never widen it to other users.
  const where: Prisma.ExpenseWhereInput = {
    userId: session.user.id,
  };

  if (filters.categoryIds && filters.categoryIds.length > 0) {
    where.categoryId = { in: filters.categoryIds };
  }

  if (filters.dateFrom || filters.dateTo) {
    where.date = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }

  if (filters.search) {
    where.description = { contains: filters.search, mode: "insensitive" };
  }

  const [expenses, categories] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { [filters.sortBy]: filters.sortDir },
      select: {
        id: true,
        amount: true,
        description: true,
        date: true,
        categoryId: true,
        category: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.category.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, color: true },
    }),
  ]);

  // Serialization boundary: map Decimal -> string, Date -> ISO string,
  // before handing off to the client component.
  const serializedExpenses = expenses.map((expense) => ({
    id: expense.id,
    amount: decimalToString(expense.amount),
    description: expense.description,
    date: expense.date.toISOString(),
    categoryId: expense.categoryId,
    category: expense.category,
  }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-[#1c1a17] dark:text-white">
          Transactions
        </h1>
        <p className="mt-1 text-sm text-[#6f6a60] dark:text-[#9aa0b4]">
          Track, filter, and manage your expenses.
        </p>
      </div>

      <ExpensesClient
        initialExpenses={serializedExpenses}
        categories={categories}
        currency={session.user.currency}
        initialFilters={{
          categoryIds: filters.categoryIds ?? [],
          dateFrom: filters.dateFrom ? toDateInputValue(filters.dateFrom) : "",
          dateTo: filters.dateTo ? toDateInputValue(filters.dateTo) : "",
          search: filters.search ?? "",
          sortBy: filters.sortBy,
          sortDir: filters.sortDir,
        }}
      />
    </div>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toArray(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  const arr = Array.isArray(value) ? value : [value];
  const filtered = arr.filter((v) => v.length > 0);
  return filtered.length > 0 ? filtered : undefined;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : value;
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}
