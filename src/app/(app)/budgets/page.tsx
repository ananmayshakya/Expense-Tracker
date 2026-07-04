import { Prisma } from "@/generated/prisma/client";
import { decimalToString } from "@/lib/money";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import BudgetsClient from "./BudgetsClient";

type SearchParams = { [key: string]: string | string[] | undefined };

/** First instant of the given (1-based) month, in local server time. */
function startOfMonth(year: number, month1based: number): Date {
  return new Date(year, month1based - 1, 1, 0, 0, 0, 0);
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parses & validates the `month`/`year` search params server-side,
 * defaulting to the current month/year — same pattern as the expenses
 * page's filter parsing (never trust raw query params; clamp to a sane
 * range).
 */
function parseMonthYear(searchParams: SearchParams): { month: number; year: number } {
  const now = new Date();
  const rawMonth = firstValue(searchParams.month);
  const rawYear = firstValue(searchParams.year);

  let month = rawMonth ? Number.parseInt(rawMonth, 10) : now.getMonth() + 1;
  let year = rawYear ? Number.parseInt(rawYear, 10) : now.getFullYear();

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    month = now.getMonth() + 1;
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    year = now.getFullYear();
  }

  return { month, year };
}

/**
 * Budgets page (§9.5, Phase 6). Server Component: everything is scoped to
 * `session.user.id` (§7) — the selected month/year comes from validated
 * URL search params (consistent with the expenses page), and every Prisma
 * query below filters by `userId: session.user.id`.
 *
 * Spent-vs-budget is computed server-side entirely with `Prisma.Decimal`
 * (via `_sum`/`groupBy` aggregates, which return Decimal) — comparisons
 * (over/under budget) are also done with Decimal methods, never floats.
 * Values are converted to strings/numbers only at the very end, right
 * before handing off to the client component for rendering.
 */
export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const userId = session.user.id;
  const rawParams = await searchParams;
  const { month, year } = parseMonthYear(rawParams);

  const monthStart = startOfMonth(year, month);
  const nextMonthStart = month === 12 ? startOfMonth(year + 1, 1) : startOfMonth(year, month + 1);

  const [categories, budgets, overallSpentAgg, categorySpentRaw] = await Promise.all([
    prisma.category.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, color: true },
    }),
    prisma.budget.findMany({
      where: { userId, month, year },
      select: { id: true, amount: true, categoryId: true },
    }),
    // Overall spent = sum of ALL the user's expenses in the selected month.
    prisma.expense.aggregate({
      where: { userId, date: { gte: monthStart, lt: nextMonthStart } },
      _sum: { amount: true },
    }),
    // Per-category spent, grouped server-side.
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: { userId, date: { gte: monthStart, lt: nextMonthStart } },
      _sum: { amount: true },
    }),
  ]);

  const spentByCategoryId = new Map<string | null, Prisma.Decimal>();
  for (const row of categorySpentRaw) {
    spentByCategoryId.set(row.categoryId, row._sum.amount ?? new Prisma.Decimal(0));
  }

  const overallBudget = budgets.find((b) => b.categoryId === null) ?? null;
  const categoryBudgets = budgets.filter(
    (b): b is typeof b & { categoryId: string } => b.categoryId !== null
  );

  const overallSpent = overallSpentAgg._sum.amount ?? new Prisma.Decimal(0);

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const serializedCategoryBudgets = categoryBudgets.map((b) => {
    const category = categoryById.get(b.categoryId);
    const spent = spentByCategoryId.get(b.categoryId) ?? new Prisma.Decimal(0);
    return {
      id: b.id,
      categoryId: b.categoryId,
      categoryName: category?.name ?? "Unknown",
      categoryColor: category?.color ?? "#6b7280",
      amount: decimalToString(b.amount),
      spent: decimalToString(spent),
    };
  });

  // Categories that don't yet have a budget this month — offered in the
  // "add per-category budget" form's <select>, scoped to the user's own
  // categories only.
  const budgetedCategoryIds = new Set(categoryBudgets.map((b) => b.categoryId));
  const availableCategories = categories.filter((c) => !budgetedCategoryIds.has(c.id));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-[#1c1a17] dark:text-white">Budgets</h1>
        <p className="mt-1 text-sm text-[#6f6a60] dark:text-[#9aa0b4]">
          Set monthly budgets and track spend against them.
        </p>
      </div>

      <BudgetsClient
        month={month}
        year={year}
        currency={session.user.currency}
        overallBudget={
          overallBudget
            ? { id: overallBudget.id, amount: decimalToString(overallBudget.amount) }
            : null
        }
        overallSpent={decimalToString(overallSpent)}
        categoryBudgets={serializedCategoryBudgets}
        availableCategories={availableCategories}
      />
    </div>
  );
}
