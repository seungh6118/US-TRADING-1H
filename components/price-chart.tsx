"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { PricePoint } from "@/lib/types";
import { formatCompactNumber } from "@/lib/utils";

export function PriceChart({ history }: { history: PricePoint[] }) {
  const data = history.slice(-90).map((point) => ({
    date: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    close: Number(point.close.toFixed(2)),
    volume: Math.round(point.volume / 1_000_000)
  }));

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="date" minTickGap={30} stroke="rgba(154,179,198,0.7)" />
          <YAxis yAxisId="price" orientation="right" stroke="rgba(154,179,198,0.7)" domain={["dataMin - 5", "dataMax + 5"]} />
          <YAxis yAxisId="volume" hide domain={[0, "dataMax + 5"]} />
          <Tooltip
            contentStyle={{
              background: "rgba(7, 16, 24, 0.96)",
              border: "1px solid rgba(105, 212, 255, 0.16)",
              borderRadius: 16
            }}
            formatter={(value, name) => {
              if (name === "volume") {
                return [`${formatCompactNumber(Number(value) * 1_000_000)}`, "Volume"];
              }
              return [`$${value}`, "Close"];
            }}
          />
          <Bar yAxisId="volume" dataKey="volume" fill="rgba(255,255,255,0.12)" radius={[4, 4, 0, 0]} barSize={8} />
          <Line yAxisId="price" type="monotone" dataKey="close" stroke="#69d4ff" strokeWidth={2.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
