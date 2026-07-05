import type { Prisma } from "@/generated/prisma/client";
import { type ExpenseFilterInput, expenseFilterSchema } from "@/lib/validations";

/**
 * Shared filter -> Prisma `where`/`orderBy` builder for expenses (§9.2,
 * §9.7). Extracted from the Phase 4 expenses page so the CSV export route
 * (Phase 9) can build the EXACT same query the on-screen filtered view
 * uses — same filters, same scoping rule.
 *
 * `userId` must always come from a server-verified source (the session
 * user for a self-export, or an admin-gated target user for an admin
 * export) — NEVER from unvalidated client input. Every clause here is
 * additive on top of `userId`, so client-supplied filter params can only
 * narrow the result set, never widen it to another user's rows.
 */

export type SearchParams = { [key: string]: string | string[] | undefined };

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

/**
 * Parses raw search params (from a page's `searchParams` or a route
 * handler's `request.nextUrl.searchParams`) into a validated
 * `ExpenseFilterInput` via `expenseFilterSchema`.
 */
export function parseExpenseFilters(rawParams: SearchParams): ExpenseFilterInput {
  return expenseFilterSchema.parse({
    categoryIds: toArray(rawParams.categoryIds),
    dateFrom: emptyToUndefined(firstValue(rawParams.dateFrom)),
    dateTo: emptyToUndefined(firstValue(rawParams.dateTo)),
    search: emptyToUndefined(firstValue(rawParams.search)),
    sortBy: emptyToUndefined(firstValue(rawParams.sortBy)) ?? "date",
    sortDir: emptyToUndefined(firstValue(rawParams.sortDir)) ?? "desc",
  });
}

/**
 * Converts a `URLSearchParams` (route handler) into the plain
 * `SearchParams` shape `parseExpenseFilters` expects, preserving
 * multi-value keys like `categoryIds`.
 */
export function searchParamsFromUrl(searchParams: URLSearchParams): SearchParams {
  const result: SearchParams = {};
  for (const key of searchParams.keys()) {
    if (result[key] !== undefined) continue; // already collected via getAll
    const values = searchParams.getAll(key);
    result[key] = values.length > 1 ? values : values[0];
  }
  return result;
}

/**
 * Builds the Prisma `where`/`orderBy` for an expenses query, scoped to
 * `userId`. This is the SAME construction the Phase 4 expenses page uses —
 * factored out here so the CSV export route (Phase 9) stays in lockstep
 * with the on-screen filtered view.
 */
export function buildExpenseQuery(
  userId: string,
  filters: ExpenseFilterInput
): { where: Prisma.ExpenseWhereInput; orderBy: Prisma.ExpenseOrderByWithRelationInput } {
  const where: Prisma.ExpenseWhereInput = {
    userId,
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

  const orderBy: Prisma.ExpenseOrderByWithRelationInput = { [filters.sortBy]: filters.sortDir };

  return { where, orderBy };
}
