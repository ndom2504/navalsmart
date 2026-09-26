"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

export function CostSplit({
  slices,
  totalLabel,
}: {
  slices: { name: string; value: number; color: string }[];
  totalLabel: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (!total) {
    return <p className="text-sm text-steel">Aucun coût direct à répartir.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" innerRadius={58} outerRadius={78} paddingAngle={2} stroke="none">
              {slices.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-lg font-semibold text-navy">{totalLabel}</p>
          <p className="text-xs text-steel">Total</p>
        </div>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {slices.map((slice) => (
          <li key={slice.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-navy">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
              {slice.name}
            </span>
            <span className="tabular-nums text-steel">{Math.round((slice.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
