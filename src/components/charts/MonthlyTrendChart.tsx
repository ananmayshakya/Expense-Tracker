"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatMoney } from "@/lib/currency";

export type MonthlyTotal = {
  label: string; // e.g. "Feb 2026"
  total: number; // already converted from Prisma.Decimal server-side
};

/**
 * Bar chart of total spend over the last 6 months (PLAN.md §9.4/§16).
 * Receives pre-aggregated, already-serialized `number` totals — bucketing
 * and Decimal summing happens server-side in the dashboard page.
 */
export default function MonthlyTrendChart({
  data,
  currency,
}: {
  data: MonthlyTotal[];
  currency: string;
}) {
  const hasData = data.some((d) => d.total > 0);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4ddcf" opacity={0.4} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: "#6f6a60" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#6f6a60" }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        {hasData && (
          <Tooltip
            formatter={(value) =>
              formatMoney(typeof value === "number" ? value : Number(value ?? 0), currency)
            }
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e4ddcf",
              fontSize: 13,
            }}
          />
        )}
        <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}
