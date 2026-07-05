import { decimalToString } from "@/lib/money";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import RecurringClient from "./RecurringClient";

/**
 * Recurring expenses page (§9.6, Phase 7). Server Component: loads ONLY
 * the current user's recurring definitions and categories — never another
 * user's — and hands them to the client component for interactivity.
 * Mutations go through the server actions in `src/actions/recurring.ts`,
 * which re-verify ownership (and category ownership) server-side.
 *
 * Serialization boundary: Decimal -> string, Date -> ISO string, before
 * crossing into the client component (mirrors expenses/budgets pages).
 * Materialization itself (processDueRecurring) runs on dashboard load and
 * via the "Run now" button (runRecurringNow action) — NOT on every visit
 * to this page, per the §9.6 DECISION.
 */
export default async function RecurringPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const [recurring, categories] = await Promise.all([
    prisma.recurringExpense.findMany({
      where: { userId },
      orderBy: [{ active: "desc" }, { nextRunDate: "asc" }],
      select: {
        id: true,
        amount: true,
        description: true,
        frequency: true,
        nextRunDate: true,
        active: true,
        categoryId: true,
        category: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.category.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, color: true },
    }),
  ]);

  const serializedRecurring = recurring.map((row) => ({
    id: row.id,
    amount: decimalToString(row.amount),
    description: row.description,
    frequency: row.frequency,
    nextRunDate: row.nextRunDate.toISOString(),
    active: row.active,
    categoryId: row.categoryId,
    category: row.category,
  }));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-[#1c1a17] dark:text-white">Recurring</h1>
        <p className="mt-1 text-sm text-[#6f6a60] dark:text-[#9aa0b4]">
          Automate bills and subscriptions — due recurrences turn into real expenses
          automatically when you open the dashboard, or immediately with &quot;Run now&quot;.
        </p>
      </div>

      <RecurringClient
        initialRecurring={serializedRecurring}
        categories={categories}
        currency={session.user.currency}
      />
    </div>
  );
}
