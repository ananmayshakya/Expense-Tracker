import { describe, expect, it } from "vitest";

import { formatMoney } from "@/lib/currency";

/**
 * PLAN.md §11 item 2 — `formatMoney`: correct symbol + decimal places for
 * USD, EUR, JPY (0 decimals), INR. Locale is pinned to "en-US" in
 * `formatMoney` itself (Phase 8 hydration-mismatch fix), so we assert
 * exact en-US-locale output strings here.
 */
describe("formatMoney", () => {
  it("formats USD with 2 decimals and a $ symbol", () => {
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
  });

  it("formats EUR with 2 decimals and a € symbol", () => {
    expect(formatMoney(1234.5, "EUR")).toBe("€1,234.50");
  });

  it("formats JPY with 0 decimals", () => {
    expect(formatMoney(1234, "JPY")).toBe("¥1,234");
  });

  it("formats INR with 2 decimals and a ₹ symbol", () => {
    expect(formatMoney(1234.5, "INR")).toBe("₹1,234.50");
  });

  it("groups large amounts correctly (USD)", () => {
    expect(formatMoney(1234567.89, "USD")).toBe("$1,234,567.89");
  });

  it("groups large amounts correctly (JPY, 0 decimals)", () => {
    expect(formatMoney(1234567, "JPY")).toBe("¥1,234,567");
  });

  it("accepts a numeric string amount (e.g. a serialized Decimal)", () => {
    expect(formatMoney("42.05", "USD")).toBe("$42.05");
  });

  it("throws for a non-finite amount", () => {
    expect(() => formatMoney(Number.NaN, "USD")).toThrow();
  });
});
