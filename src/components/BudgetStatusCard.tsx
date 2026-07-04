import { formatMoney } from "@/lib/currency";

const OVER_BUDGET_COLOR = "#ef4444";

/**
 * Compact overall-budget status panel for the dashboard (PLAN.md §9.4 —
 * the "active budget status" the Phase 5 placeholder deferred to Phase 6,
 * §16 budget-bar spec: track neutral, fill accent, over-budget -> red
 * `#ef4444`). Server Component — purely presentational; the caller
 * (dashboard page) has already done all money math with `Prisma.Decimal`
 * and only passes stringified amounts + a pre-computed `isOverBudget`
 * boolean (never re-derived from floats here).
 */
export default function BudgetStatusCard({
  currency,
  budget,
}: {
  currency: string;
  budget: { amount: string; spent: string; isOverBudget: boolean } | null;
}) {
  if (!budget) {
    return (
      <div className="rounded-[12px] bg-[#fffdf8] p-5 dark:bg-[#272341]">
        <h2 className="text-sm font-semibold text-[#1c1a17] dark:text-white">
          Budget status
        </h2>
        <p className="mt-2 text-sm text-[#6f6a60] dark:text-[#9aa0b4]">
          No budget set for this month.
        </p>
      </div>
    );
  }

  const spentNum = Number(budget.spent);
  const budgetNum = Number(budget.amount);
  // True percentage (can exceed 100 when over budget) for the label;
  // the bar's fill WIDTH is separately clamped to 100 so it never
  // overflows its track.
  const truePct = budgetNum > 0 ? (spentNum / budgetNum) * 100 : 0;
  const widthPct = Math.min(100, truePct);

  return (
    <div className="rounded-[12px] bg-[#fffdf8] p-5 dark:bg-[#272341]">
      <h2 className="text-sm font-semibold text-[#1c1a17] dark:text-white">Budget status</h2>
      <div className="mt-3 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-[#1c1a17] dark:text-white">
            {formatMoney(budget.spent, currency)} of {formatMoney(budget.amount, currency)}
          </span>
          <span
            className={`text-xs font-semibold ${
              budget.isOverBudget ? "text-[#ef4444]" : "text-[#6f6a60] dark:text-[#9aa0b4]"
            }`}
          >
            {budgetNum > 0 ? `${truePct.toFixed(0)}%` : "—"}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${widthPct}%`,
              backgroundColor: budget.isOverBudget ? OVER_BUDGET_COLOR : "#3b82f6",
            }}
          />
        </div>
        {budget.isOverBudget && (
          <p className="text-xs font-medium text-[#ef4444]" role="alert">
            Over budget by {formatMoney((spentNum - budgetNum).toFixed(2), currency)}
          </p>
        )}
      </div>
    </div>
  );
}
