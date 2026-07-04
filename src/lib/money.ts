import { Prisma } from "@/generated/prisma/client";

/**
 * Decimal-safe money helpers (PLAN.md §10).
 *
 * Rule: all money arithmetic uses `Prisma.Decimal` (re-exported from
 * `@/generated/prisma/client`, backed by decimal.js). Never use JS
 * `number` for money math — only convert to `number`/string at the display
 * boundary (formatting, or serializing across the RSC -> client boundary).
 */

const MAX_DECIMAL_12_2 = new Prisma.Decimal("9999999999.99");

/**
 * Parses user input (string or number) into a validated `Prisma.Decimal`
 * suitable for storage in a `Decimal(12,2)` column. Throws on invalid
 * input (NaN, negative, zero, more than 2 decimal places, or out of the
 * Decimal(12,2) range) — callers should validate with `expenseSchema`
 * first and treat this as a defense-in-depth boundary.
 */
export function parseDecimalInput(value: string | number): Prisma.Decimal {
  const decimal = new Prisma.Decimal(value);

  if (decimal.isNaN() || !decimal.isFinite()) {
    throw new Error("Amount must be a finite number.");
  }
  if (decimal.lessThanOrEqualTo(0)) {
    throw new Error("Amount must be greater than zero.");
  }
  if (decimal.decimalPlaces() > 2) {
    throw new Error("Amount must have at most 2 decimal places.");
  }
  if (decimal.greaterThan(MAX_DECIMAL_12_2)) {
    throw new Error("Amount is too large.");
  }

  return decimal;
}

/**
 * Converts a `Prisma.Decimal` (or decimal-like value returned by Prisma) to
 * a string — the safe way to cross the RSC -> client component boundary,
 * since raw `Decimal` objects are not serializable and a JS `number` can
 * lose precision. Use `formatMoney` (lib/currency.ts) to render it.
 */
export function decimalToString(value: Prisma.Decimal | number | string): string {
  return new Prisma.Decimal(value).toFixed(2);
}

/**
 * Converts a `Prisma.Decimal` (or decimal-like value) to a JS `number`.
 * ONLY use this at the final display boundary (e.g. handing off to
 * `Intl.NumberFormat` via `formatMoney`) — never for further arithmetic.
 */
export function decimalToNumber(value: Prisma.Decimal | number | string): number {
  return new Prisma.Decimal(value).toNumber();
}
