import { describe, expect, it } from "vitest";

import { advanceDate, computeDueRuns } from "@/lib/recurrence";

/**
 * PLAN.md §11 item 4 — `advanceDate` + multi-period catch-up.
 *
 * Documented convention (recurrence.ts): MONTHLY/YEARLY clamp the
 * day-of-month to the last valid day of the target month rather than
 * overflowing (Jan 31 -> Feb 28/29, not Mar 3).
 */
describe("advanceDate", () => {
  it("DAILY advances by exactly one day", () => {
    const start = new Date(2026, 5, 15, 10, 0, 0); // Jun 15, 2026, 10:00
    const next = advanceDate(start, "DAILY");
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(5);
    expect(next.getDate()).toBe(16);
    expect(next.getTime()).toBeGreaterThan(start.getTime());
  });

  it("WEEKLY advances by exactly seven days", () => {
    const start = new Date(2026, 5, 15, 10, 0, 0);
    const next = advanceDate(start, "WEEKLY");
    expect(next.getMonth()).toBe(5);
    expect(next.getDate()).toBe(22);
    expect(next.getTime()).toBeGreaterThan(start.getTime());
  });

  it("MONTHLY advances by one calendar month in the ordinary case", () => {
    const start = new Date(2026, 2, 15); // Mar 15, 2026
    const next = advanceDate(start, "MONTHLY");
    expect(next.getMonth()).toBe(3); // April
    expect(next.getDate()).toBe(15);
    expect(next.getTime()).toBeGreaterThan(start.getTime());
  });

  it("YEARLY advances by one calendar year in the ordinary case", () => {
    const start = new Date(2026, 5, 15);
    const next = advanceDate(start, "YEARLY");
    expect(next.getFullYear()).toBe(2027);
    expect(next.getMonth()).toBe(5);
    expect(next.getDate()).toBe(15);
    expect(next.getTime()).toBeGreaterThan(start.getTime());
  });

  it("MONTHLY: Jan 31 -> Feb 28 in a non-leap year (2026)", () => {
    const start = new Date(2026, 0, 31); // Jan 31, 2026 (2026 is not a leap year)
    const next = advanceDate(start, "MONTHLY");
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(1); // February
    expect(next.getDate()).toBe(28);
    expect(next.getTime()).toBeGreaterThan(start.getTime());
  });

  it("MONTHLY: Jan 31 -> Feb 29 in a leap year (2028)", () => {
    const start = new Date(2028, 0, 31); // Jan 31, 2028 (2028 IS a leap year)
    const next = advanceDate(start, "MONTHLY");
    expect(next.getFullYear()).toBe(2028);
    expect(next.getMonth()).toBe(1); // February
    expect(next.getDate()).toBe(29);
    expect(next.getTime()).toBeGreaterThan(start.getTime());
  });

  it("YEARLY: Feb 29 (leap) -> Feb 28 next year (non-leap)", () => {
    const start = new Date(2028, 1, 29); // Feb 29, 2028
    const next = advanceDate(start, "YEARLY");
    expect(next.getFullYear()).toBe(2029);
    expect(next.getMonth()).toBe(1); // February
    expect(next.getDate()).toBe(28);
    expect(next.getTime()).toBeGreaterThan(start.getTime());
  });

  it("MONTHLY: Dec -> Jan rollover advances the year", () => {
    const start = new Date(2026, 11, 15); // Dec 15, 2026
    const next = advanceDate(start, "MONTHLY");
    expect(next.getFullYear()).toBe(2027);
    expect(next.getMonth()).toBe(0); // January
    expect(next.getDate()).toBe(15);
    expect(next.getTime()).toBeGreaterThan(start.getTime());
  });

  it("YEARLY: Dec -> Jan style year rollover also advances the year forward", () => {
    const start = new Date(2026, 11, 31); // Dec 31, 2026
    const next = advanceDate(start, "YEARLY");
    expect(next.getFullYear()).toBe(2027);
    expect(next.getMonth()).toBe(11);
    expect(next.getDate()).toBe(31);
    expect(next.getTime()).toBeGreaterThan(start.getTime());
  });

  it("result is always strictly later than the input, across all frequencies", () => {
    const start = new Date(2026, 7, 1, 12, 30, 0);
    for (const freq of ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const) {
      const next = advanceDate(start, freq);
      expect(next.getTime()).toBeGreaterThan(start.getTime());
    }
  });
});

/**
 * PLAN.md §11 item 4 (multi-period catch-up) — unit-tested via the
 * behavior-preserving `computeDueRuns` extraction (see recurrence.ts),
 * without needing a DB.
 */
describe("computeDueRuns", () => {
  it("a DAILY row 5 days + 1 hour overdue yields exactly 6 due dates and a final date > now", () => {
    const now = new Date(2026, 6, 10, 9, 0, 0); // Jul 10, 2026, 09:00
    // 5 days + 1 hour before `now`.
    const nextRunDate = new Date(2026, 6, 5, 8, 0, 0);

    const { dueDates, finalNextRunDate } = computeDueRuns(nextRunDate, "DAILY", now);

    // Due dates: Jul 5 08:00, 6, 7, 8, 9, 10 08:00 (10 08:00 <= now 09:00) = 6 entries.
    expect(dueDates.length).toBe(6);
    expect(dueDates[0].getTime()).toBe(nextRunDate.getTime());
    for (const d of dueDates) {
      expect(d.getTime()).toBeLessThanOrEqual(now.getTime());
    }
    expect(finalNextRunDate.getTime()).toBeGreaterThan(now.getTime());
  });

  it("an already-future nextRunDate yields zero due dates and an unchanged finalNextRunDate", () => {
    const now = new Date(2026, 6, 10, 9, 0, 0);
    const nextRunDate = new Date(2026, 6, 15); // 5 days in the future

    const { dueDates, finalNextRunDate } = computeDueRuns(nextRunDate, "DAILY", now);

    expect(dueDates.length).toBe(0);
    expect(finalNextRunDate.getTime()).toBe(nextRunDate.getTime());
  });

  it("a WEEKLY row overdue by 3 periods yields 4 due dates (inclusive of the run landing exactly on `now`)", () => {
    const now = new Date(2026, 6, 22, 0, 0, 0);
    const nextRunDate = new Date(2026, 6, 1, 0, 0, 0); // Jul 1, 8, 15, 22 are all <= now

    const { dueDates, finalNextRunDate } = computeDueRuns(nextRunDate, "WEEKLY", now);

    expect(dueDates.length).toBe(4);
    expect(finalNextRunDate.getTime()).toBeGreaterThan(now.getTime());
  });

  it("respects a custom iteration cap, stopping early on pathological input", () => {
    const now = new Date(2030, 0, 1); // far future relative to nextRunDate
    const nextRunDate = new Date(2000, 0, 1);

    const { dueDates } = computeDueRuns(nextRunDate, "DAILY", now, 10);

    // cap=10 means the loop breaks once iterations > 10, i.e. after pushing 11 dates.
    expect(dueDates.length).toBe(11);
  });

  it("a single overdue period yields exactly one due date equal to nextRunDate", () => {
    const now = new Date(2026, 6, 10, 12, 0, 0);
    const nextRunDate = new Date(2026, 6, 10, 6, 0, 0);

    const { dueDates, finalNextRunDate } = computeDueRuns(nextRunDate, "DAILY", now);

    expect(dueDates.length).toBe(1);
    expect(dueDates[0].getTime()).toBe(nextRunDate.getTime());
    expect(finalNextRunDate.getTime()).toBeGreaterThan(now.getTime());
  });
});
