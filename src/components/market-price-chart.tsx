"use client";

import { useEffect, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const CHART_HEIGHT_PX = 288;

export type ChartRow = {
  t: string;
  [key: string]: string | number;
};

export function MarketPriceChart({
  data,
  outcomeKeys,
}: {
  data: ChartRow[];
  outcomeKeys: { key: string; name: string; color: string }[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const measure = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      if (w > 0) {
        setChartWidth((prev) => (prev === w ? prev : w));
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(measure);
    });

    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay historial de operaciones.
      </p>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="h-72 w-full min-w-0 overflow-hidden"
      style={{ minHeight: CHART_HEIGHT_PX }}
    >
      {chartWidth > 0 ? (
        <LineChart
          width={chartWidth}
          height={CHART_HEIGHT_PX}
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="t" tick={{ fontSize: 11 }} />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value) => [
              `${(Number(value ?? 0) * 100).toFixed(1)}%`,
              "",
            ]}
          />
          <Legend />
          {outcomeKeys.map((o) => (
            <Line
              key={o.key}
              type="monotone"
              dataKey={o.key}
              name={o.name}
              stroke={o.color}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      ) : (
        <div
          className="h-full w-full rounded-md bg-muted/30"
          aria-hidden
        />
      )}
    </div>
  );
}
