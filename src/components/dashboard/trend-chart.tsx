"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TrendChart({ data }: { data: { label: string; total: number; count: number }[] }) {
  if (!data.length) {
    return <p className="text-sm text-steel">Pas encore assez de points pour tracer l&apos;évolution.</p>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e7edf3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#5c6b7a", fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="cost"
            tick={{ fill: "#5c6b7a", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(value: number) => (value >= 1_000_000 ? `${(value / 1_000_000).toLocaleString("fr-CA", { maximumFractionDigits: 1 })} M$` : `${Math.round(value / 1000)} k$`)}
          />
          <YAxis yAxisId="count" orientation="right" hide />
          <Tooltip
            formatter={(value, name) => [
              name === "count" ? String(value) : `${Number(value).toLocaleString("fr-CA")} $`,
              name === "count" ? "Nombre de projets" : "Coût estimé",
            ]}
            contentStyle={{ border: "1px solid #e1e7ee", borderRadius: 8, fontSize: 12 }}
          />
          {data.some((point) => point.count > 0) ? (
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: 12, color: "#5c6b7a" }}
              formatter={(value) => (value === "count" ? "Nombre de projets" : "Coût estimé")}
            />
          ) : null}
          <Line yAxisId="cost" type="monotone" dataKey="total" stroke="#1d4e89" strokeWidth={2.5} dot={{ r: 3, fill: "#1d4e89" }} />
          {data.some((point) => point.count > 0) ? <Line yAxisId="count" type="monotone" dataKey="count" stroke="#8fb4d9" strokeWidth={2} dot={{ r: 3, fill: "#8fb4d9" }} /> : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
