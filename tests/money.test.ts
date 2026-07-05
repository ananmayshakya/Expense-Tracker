import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { decimalToNumber, decimalToString, parseDecimalInput } from "@/lib/money";

/**
 * PLAN.md §11 item 3 — `lib/money.ts`:
 * - Decimal arithmetic doesn't drift (0.1+0.2, 10.10+20.20, a longer series).
 * - `parseDecimalInput` accepts valid amounts and rejects negatives/zero/
 *   >2dp/out-of-range.
 */
describe("Prisma.Decimal arithmetic (no float drift)", () => {
  it("0.1 + 0.2 is exactly 0.3 (not 0.30000000000000004 like JS float)", () => {
    const sum = new Prisma.Decimal("0.1").plus(new Prisma.Decimal("0.2"));
    expect(sum.toFixed(2)).toBe("0.30");
    expect(sum.equals(new Prisma.Decimal("0.3"))).toBe(true);
    // Sanity check that this would actually drift with plain JS numbers.
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it("10.10 + 20.20 is exactly 30.30", () => {
    const sum = new Prisma.Decimal("10.10").plus(new Prisma.Decimal("20.20"));
    expect(sum.toFixed(2)).toBe("30.30");
  });

  it("a longer series of Decimal additions yields an exact result", () => {
    const values = ["0.1", "0.2", "0.3", "10.10", "20.20", "99.99", "1234.56"];
    const total = values.reduce(
      (acc, v) => acc.plus(new Prisma.Decimal(v)),
      new Prisma.Decimal(0)
    );
    expect(total.toFixed(2)).toBe("1365.45");
  });

  it("decimalToString / decimalToNumber convert exactly at the display boundary", () => {
    const d = new Prisma.Decimal("10.10").plus(new Prisma.Decimal("20.20"));
    expect(decimalToString(d)).toBe("30.30");
    expect(decimalToNumber(d)).toBe(30.3);
  });
});

describe("parseDecimalInput", () => {
  it("accepts a valid amount", () => {
    const d = parseDecimalInput("42.50");
    expect(d.toFixed(2)).toBe("42.50");
  });

  it("accepts a valid integer amount", () => {
    const d = parseDecimalInput(100);
    expect(d.toFixed(2)).toBe("100.00");
  });

  it("rejects zero", () => {
    expect(() => parseDecimalInput(0)).toThrow("greater than zero");
  });

  it("rejects a negative amount", () => {
    expect(() => parseDecimalInput(-5)).toThrow("greater than zero");
  });

  it("rejects more than 2 decimal places", () => {
    expect(() => parseDecimalInput("1.234")).toThrow("2 decimal places");
  });

  it("rejects an amount above the Decimal(12,2) range", () => {
    expect(() => parseDecimalInput("10000000000.00")).toThrow("too large");
  });

  it("rejects a non-finite amount", () => {
    expect(() => parseDecimalInput(Number.NaN)).toThrow();
  });

  it("accepts the maximum in-range amount", () => {
    const d = parseDecimalInput("9999999999.99");
    expect(d.toFixed(2)).toBe("9999999999.99");
  });
});
