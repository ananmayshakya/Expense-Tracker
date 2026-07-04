"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatMoney } from "@/lib/currency";

export type CategorySlice = {
  id: string;
  name: string;
  color: string;
  total: number; // already converted from Prisma.Decimal server-side
};

/**
 * Donut chart of spend-by-category for the current month (PLAN.md §9.4/§16).
 * Receives pre-aggregated, already-serialized `number` totals — all the
 * Decimal summing happens server-side in the dashboard page (§10: never
 * sum money as JS floats). Slice colors are each category's stored
 * `color`; "Uncategorized" gets a neutral gray.
 */
export default function CategoryDonutChart({
  data,
  currency,
}: {
  data: CategorySlice[];
  currency: string;
}) {
  const hasData = data.some((d) => d.total > 0);

  if (!hasData) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-[#6f6a60] dark:text-[#9aa0b4]">
        No expenses recorded this month yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="name"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((slice) => (
            <Cell key={slice.id} fill={slice.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [
            formatMoney(typeof value === "number" ? value : Number(value ?? 0), currency),
            name,
          ]}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e4ddcf",
            fontSize: 13,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
