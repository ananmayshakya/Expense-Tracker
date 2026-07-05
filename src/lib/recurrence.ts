import { RecurrenceFrequency } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Recurring-expense materialization engine (PLAN.md §9.6 DECISION, §6
 * schema, §11 testing list).
 *
 * `advanceDate` is a pure function (no DB, no `now()` inside) so it can be
 * unit-tested deterministically in Phase 11 — every call must return a
 * strictly LATER Date than the input, which is what lets the catch-up loop
 * in `processDueRecurring` terminate.
 *
 * MONTHLY/YEARLY month-length edge cases (documented convention):
 * JS `Date.setMonth` naively overflows when the target month is shorter
 * than the source day-of-month (e.g. Jan 31 + 1 month -> "Mar 3", skipping
 * February entirely). That's wrong for a recurring bill semantics ("the
 * 31st of each month" should land in February, not roll into March). This
 * app's convention: if the source day-of-month doesn't exist in the target
 * month, CLAMP to the last day of the target month instead of overflowing.
 *   - Jan 31 (MONTHLY) -> Feb 28 (or Feb 29 in a leap year)
 *   - Feb 29 (YEARLY, leap day) -> Feb 28 in a non-leap year
 * This can "drift" the day-of-month over time (e.g. a monthly recurrence
 * starting Jan 31 will sit on the 28th/29th/30th of short months forever
 * after touching February) — that drift is accepted/intentional for this
 * app rather than trying to "restore" the 31st in longer months later.
 */
export function advanceDate(date: Date, frequency: RecurrenceFrequency): Date {
  switch (frequency) {
    case "DAILY": {
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      return next;
    }
    case "WEEKLY": {
      const next = new Date(date);
      next.setDate(next.getDate() + 7);
      return next;
    }
    case "MONTHLY":
      return addMonthsClamped(date, 1);
    case "YEARLY":
      return addMonthsClamped(date, 12);
    default: {
      // Exhaustiveness guard — RecurrenceFrequency is a fixed enum, so this
      // should be unreachable, but fail loudly rather than silently
      // returning a non-advancing date if the enum is ever extended.
      const _exhaustive: never = frequency;
      throw new Error(`Unhandled RecurrenceFrequency: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Adds `months` calendar months to `date`, clamping the day-of-month to the
 * last valid day of the target month instead of letting it overflow into a
 * later month (the documented convention above). Preserves time-of-day.
 */
function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  const targetMonthIndex = month + months;
  // Last day of the target month: day 0 of the FOLLOWING month.
  const lastDayOfTargetMonth = new Date(
    year,
    targetMonthIndex + 1,
    0,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  ).getDate();

  const clampedDay = Math.min(day, lastDayOfTargetMonth);

  return new Date(
    year,
    targetMonthIndex,
    clampedDay,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );
}

/** Safety valve against pathological input (e.g. a corrupted nextRunDate far
 * in the past combined with DAILY frequency) — a few thousand iterations
 * comfortably covers any realistic overdue window (thousands of days /
 * years) while guaranteeing the loop can never run unbounded. */
const MAX_CATCHUP_ITERATIONS = 5000;

export type ProcessDueRecurringResult = {
  /** Total number of Expense rows created across all recurring definitions. */
  expensesCreated: number;
  /** Number of recurring rows that had at least one due period processed. */
  rowsProcessed: number;
};

/**
 * Materializes all due recurring expenses for `userId` (PLAN.md §9.6
 * DECISION). SECURITY: `userId` MUST always be supplied by the server from
 * the verified session — this function must NEVER be reachable with a
 * client-supplied userId (no 'use server' directive here; call it only
 * from trusted server-side call sites: the dashboard Server Component and
 * the `runRecurringNow` server action, both of which derive `userId` from
 * `requireSession()`).
 *
 * For each ACTIVE row with `nextRunDate <= now`, loops: create a real
 * Expense for the due period, then advance `nextRunDate` by the row's
 * frequency, repeating until `nextRunDate > now` (multi-period catch-up).
 * Each row's full catch-up (all its created expenses + the final
 * `nextRunDate` update) is wrapped in a single `prisma.$transaction` so a
 * row can never be left half-advanced (e.g. expenses created but
 * `nextRunDate` not persisted, which would cause duplicate materialization
 * on the next call — breaking idempotency).
 *
 * Idempotency: because only rows with `nextRunDate <= now` are selected,
 * and every processed row's `nextRunDate` is advanced strictly past `now`
 * before the transaction commits, an immediate second call finds nothing
 * left to process for those rows and creates zero new expenses.
 */
export async function processDueRecurring(userId: string): Promise<ProcessDueRecurringResult> {
  const now = new Date();

  const dueRows = await prisma.recurringExpense.findMany({
    where: {
      userId,
      active: true,
      nextRunDate: { lte: now },
    },
  });

  let expensesCreated = 0;
  let rowsProcessed = 0;

  for (const row of dueRows) {
    let iterations = 0;
    let cursor = row.nextRunDate;
    const duDates: Date[] = [];

    while (cursor <= now) {
      duDates.push(cursor);
      cursor = advanceDate(cursor, row.frequency);
      iterations += 1;
      if (iterations > MAX_CATCHUP_ITERATIONS) {
        // Pathological input guard — stop catching up further in this call;
        // the row will simply be picked up again (and continue catching up)
        // on the next processDueRecurring invocation.
        break;
      }
    }

    if (duDates.length === 0) {
      continue;
    }

    const finalNextRunDate = cursor;

    await prisma.$transaction(async (tx) => {
      await tx.expense.createMany({
        data: duDates.map((runDate) => ({
          amount: row.amount,
          description: row.description,
          date: runDate,
          userId: row.userId,
          categoryId: row.categoryId,
        })),
      });

      await tx.recurringExpense.update({
        where: { id: row.id },
        data: { nextRunDate: finalNextRunDate },
      });
    });

    expensesCreated += duDates.length;
    rowsProcessed += 1;
  }

  return { expensesCreated, rowsProcessed };
}
