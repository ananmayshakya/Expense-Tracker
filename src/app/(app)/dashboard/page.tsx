import { Prisma } from "@/generated/prisma/client";
import CategoryDonutChart, {
  type CategorySlice,
} from "@/components/charts/CategoryDonutChart";
import MonthlyTrendChart, {
  type MonthlyTotal,
} from "@/components/charts/MonthlyTrendChart";
import StatCard from "@/components/StatCard";
import { decimalToNumber } from "@/lib/money";
import { formatMoney } from "@/lib/currency";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const UNCATEGORIZED_COLOR = "#9ca3af";

/** First instant of the given month, in local server time. */
function startOfMonth(year: number, monthIndex0: number): Date {
  return new Date(year, monthIndex0, 1, 0, 0, 0, 0);
}

// Fixed locale for month labels, same rationale as the expense date-label
// fix in ExpensesClient.tsx: server and browser default locales can
// differ, and a locale-dependent string rendered from a Server Component
// would otherwise risk a hydration mismatch if ever reused client-side.
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

/**
 * Dashboard (PLAN.md §9.4, §16, §10, §7). Server Component — every query
 * below is scoped to `session.user.id`; nothing here ever reads another
 * user's rows. All money sums are done with `Prisma.Decimal` server-side
 * (via Prisma's `_sum` aggregate, which returns a Decimal) and are only
 * converted to `number`/formatted strings at the very end, right before
 * handing data to `formatMoney` or the Recharts client components.
 */
export default async function DashboardPage() {
  const session = await requireSession();
  const { user } = session;
  const userId = user.id;

  const now = new Date();
  const monthStart = startOfMonth(now.getFullYear(), now.getMonth());
  const nextMonthStart = startOfMonth(now.getFullYear(), now.getMonth() + 1);
  const lastMonthStart = startOfMonth(now.getFullYear(), now.getMonth() - 1);

  // 6-month window (this month + previous 5), oldest first.
  const sixMonthsAgoStart = startOfMonth(now.getFullYear(), now.getMonth() - 5);

  const [
    thisMonthAgg,
    lastMonthAgg,
    categoryTotalsRaw,
    categories,
    sixMonthExpenses,
  ] = await Promise.all([
    // 1. Total spent + count this month.
    prisma.expense.aggregate({
      where: { userId, date: { gte: monthStart, lt: nextMonthStart } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // 3. This-month-vs-last-month comparison metric.
    prisma.expense.aggregate({
      where: { userId, date: { gte: lastMonthStart, lt: monthStart } },
      _sum: { amount: true },
    }),
    // (a) Spend by category, this month — grouped server-side.
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: { userId, date: { gte: monthStart, lt: nextMonthStart } },
      _sum: { amount: true },
    }),
    prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, color: true },
    }),
    // (b) Raw rows for the last 6 months, bucketed manually below since
    // Postgres month-bucketing via Prisma groupBy isn't expressible
    // without raw SQL; the row count for a personal expense tracker over
    // 6 months is small, so summing in JS with Prisma.Decimal is fine
    // (still no float math — each addition uses Prisma.Decimal).
    prisma.expense.findMany({
      where: { userId, date: { gte: sixMonthsAgoStart, lt: nextMonthStart } },
      select: { amount: true, date: true },
    }),
  ]);

  // ---- Card 1 & 2: total spent this month + count ----
  const totalThisMonth = thisMonthAgg._sum.amount ?? new Prisma.Decimal(0);
  const countThisMonth = thisMonthAgg._count._all;

  // ---- Card 3: this month vs last month (a "meaningful metric we can
  // compute now" per §9.4 — budgets don't exist until Phase 6, so this is
  // NOT a budget card). ----
  const totalLastMonth = lastMonthAgg._sum.amount ?? new Prisma.Decimal(0);
  const delta = totalThisMonth.minus(totalLastMonth);
  const deltaIsIncrease = delta.greaterThan(0);
  const pctChange = totalLastMonth.isZero()
    ? null
    : delta.dividedBy(totalLastMonth).times(100);

  // ---- Chart (a): category donut, this month ----
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const categorySlices: CategorySlice[] = categoryTotalsRaw
    .map((row) => {
      const sum = row._sum.amount ?? new Prisma.Decimal(0);
      if (row.categoryId === null) {
        return {
          id: "uncategorized",
          name: "Uncategorized",
          color: UNCATEGORIZED_COLOR,
          total: decimalToNumber(sum),
        };
      }
      const category = categoryById.get(row.categoryId);
      return {
        id: row.categoryId,
        name: category?.name ?? "Unknown",
        color: category?.color ?? UNCATEGORIZED_COLOR,
        total: decimalToNumber(sum),
      };
    })
    .filter((slice) => slice.total > 0)
    .sort((a, b) => b.total - a.total);

  // ---- Chart (b): last 6 months, bucketed by calendar month, summed with
  // Prisma.Decimal (never JS floats) then converted to number only for
  // the chart. ----
  const monthBuckets: { key: string; label: string; total: Prisma.Decimal }[] = [];
  for (let i = 5; i >= 0; i--) {
    const bucketStart = startOfMonth(now.getFullYear(), now.getMonth() - i);
    monthBuckets.push({
      key: `${bucketStart.getFullYear()}-${bucketStart.getMonth()}`,
      label: MONTH_LABEL_FORMATTER.format(bucketStart),
      total: new Prisma.Decimal(0),
    });
  }
  const bucketByKey = new Map(monthBuckets.map((b) => [b.key, b]));
  for (const expense of sixMonthExpenses) {
    const d = new Date(expense.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = bucketByKey.get(key);
    if (bucket) {
      bucket.total = bucket.total.plus(expense.amount);
    }
  }
  const monthlyTotals: MonthlyTotal[] = monthBuckets.map((b) => ({
    label: b.label,
    total: decimalToNumber(b.total),
  }));

  const currency = user.currency;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total spent this month"
          value={formatMoney(decimalToNumber(totalThisMonth), currency)}
          subtext={MONTH_LABEL_FORMATTER.format(now)}
          gradient="linear-gradient(135deg, #2dd4bf, #3b82f6)"
        />
        <StatCard
          label="Expenses this month"
          value={countThisMonth.toLocaleString("en-US")}
          subtext={countThisMonth === 1 ? "expense logged" : "expenses logged"}
          gradient="linear-gradient(135deg, #fbbf24, #f97316)"
        />
        <StatCard
          label="Vs. last month"
          value={
            pctChange === null
              ? formatMoney(decimalToNumber(delta.abs()), currency)
              : `${deltaIsIncrease ? "+" : "-"}${pctChange.abs().toFixed(0)}%`
          }
          subtext={
            pctChange === null
              ? deltaIsIncrease
                ? "more than last month (no prior data)"
                : "vs. last month"
              : deltaIsIncrease
                ? "more than last month"
                : "less than last month"
          }
          gradient="linear-gradient(135deg, #fb7185, #f43f5e)"
        />
      </div>

      {/*
        Budget status will replace one of the cards above (or add a new
        one) once Phase 6 lands real Budget rows — intentionally not
        built here to avoid inventing budget logic ahead of schedule.
      */}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[12px] bg-[#fffdf8] p-5 dark:bg-[#272341]">
          <h2 className="text-sm font-semibold text-[#1c1a17] dark:text-white">
            Spend by category
          </h2>
          <p className="mb-2 text-xs text-[#6f6a60] dark:text-[#9aa0b4]">
            {MONTH_LABEL_FORMATTER.format(now)}
          </p>
          <CategoryDonutChart data={categorySlices} currency={currency} />
          {categorySlices.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {categorySlices.map((slice) => (
                <li
                  key={slice.id}
                  className="flex items-center gap-1.5 text-xs text-[#6f6a60] dark:text-[#9aa0b4]"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: slice.color }}
                    aria-hidden
                  />
                  {slice.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-[12px] bg-[#fffdf8] p-5 dark:bg-[#272341]">
          <h2 className="text-sm font-semibold text-[#1c1a17] dark:text-white">
            Last 6 months
          </h2>
          <p className="mb-2 text-xs text-[#6f6a60] dark:text-[#9aa0b4]">
            Total spend per month
          </p>
          <MonthlyTrendChart data={monthlyTotals} currency={currency} />
        </div>
      </div>
    </div>
  );
}
