/**
 * Currency helpers (PLAN.md §10).
 *
 * Store ISO 4217 codes only (`User.currency`); never hardcode symbols or
 * decimal-place counts — `Intl.NumberFormat` derives both correctly per
 * currency (e.g. JPY has 0 decimal places, USD/EUR have 2).
 */

export type SupportedCurrency = {
  code: string;
  label: string;
};

/**
 * Extensible list of supported currencies. Adding a new ISO 4217 code here
 * is the only change needed to support it — `formatMoney` derives symbol
 * and decimal formatting from `Intl.NumberFormat`.
 */
export const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  { code: "USD", label: "US Dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "JPY", label: "Japanese Yen (¥)" },
  { code: "INR", label: "Indian Rupee (₹)" },
  { code: "CAD", label: "Canadian Dollar ($)" },
  { code: "AUD", label: "Australian Dollar ($)" },
  { code: "CNY", label: "Chinese Yuan (¥)" },
];

export const SUPPORTED_CURRENCY_CODES = SUPPORTED_CURRENCIES.map((c) => c.code);

/**
 * Formats a raw amount (number or numeric string — e.g. a serialized
 * Decimal) as money in the given ISO 4217 currency code. Symbol and decimal
 * digit count come from `Intl.NumberFormat`, never hardcoded, so e.g. JPY
 * renders with 0 decimals and USD/EUR with 2.
 *
 * Locale is pinned to "en-US" rather than `undefined` (the runtime default).
 * This was originally noted as a Phase 4/§17 risk ("server vs client locale
 * divergence could cause hydration mismatches") and it surfaced for real in
 * Phase 8: switching currency to JPY rendered "¥1,234" during SSR but
 * "JP¥1,234" on the client for the exact same `Intl.NumberFormat(undefined,
 * ...)` call, because the Node process's default locale and the browser's
 * default locale resolved differently for the same currency code. Pinning
 * the locale (mirroring the existing `en-US` pin for expense date labels in
 * ExpensesClient.tsx/RecurringClient.tsx) makes SSR and client output
 * identical, closing that risk. This intentionally means all users see
 * en-US-style grouping/symbol placement regardless of browser locale —
 * consistent with the existing date-label precedent, and acceptable since
 * this is a portfolio app with a single display locale, not per-user i18n.
 */
export function formatMoney(amount: number | string, currencyCode: string): string {
  const numeric = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(numeric)) {
    throw new Error(`formatMoney: amount is not a finite number (${amount})`);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(numeric);
}
