"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_HEIGHT_PX = 320;

export type ChartRow = {
  tMs: number;
  [key: string]: string | number;
};

export type OutcomeKeySpec = {
  key: string;
  name: string;
  color: string;
};

function formatTick(ms: number): string {
  return new Date(ms).toLocaleString("es-ES", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function MarketPriceChart({
  data,
  outcomeKeys,
  showMidpointLine,
}: {
  data: ChartRow[];
  outcomeKeys: OutcomeKeySpec[];
  /** Línea al 50 % (referencia tipo Polymarket en mercados binarios). */
  showMidpointLine?: boolean;
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

  const xDomain = useMemo(() => {
    if (data.length === 0) return [0, 1] as [number, number];
    const tMin = Math.min(...data.map((d) => d.tMs));
    const tMax = Math.max(...data.map((d) => d.tMs));
    const span = tMax - tMin;
    const pad =
      span === 0 ? 120_000 : Math.max(30_000, span * 0.06);
    return [tMin - pad, tMax + pad] as [number, number];
  }, [data]);

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay historial de operaciones.
      </p>
    );
  }

  const gradientId = "price-area-0";

  return (
    <div
      ref={wrapRef}
      className="h-80 w-full min-w-0 overflow-hidden rounded-lg border bg-card/30"
      style={{ minHeight: CHART_HEIGHT_PX }}
    >
      {chartWidth > 0 ? (
        <ComposedChart
          width={chartWidth}
          height={CHART_HEIGHT_PX}
          data={data}
          margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={outcomeKeys[0]?.color ?? "#6366f1"}
                stopOpacity={0.35}
              />
              <stop
                offset="100%"
                stopColor={outcomeKeys[0]?.color ?? "#6366f1"}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="tMs"
            type="number"
            domain={xDomain}
            tickFormatter={formatTick}
            tick={{ fontSize: 10 }}
            minTickGap={28}
          />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
            tick={{ fontSize: 11 }}
            width={44}
          />
          {showMidpointLine && (
            <ReferenceLine
              y={0.5}
              stroke="#94a3b8"
              strokeDasharray="5 5"
              strokeOpacity={0.9}
              label={{
                value: "50%",
                position: "insideTopRight",
                fill: "#64748b",
                fontSize: 11,
              }}
            />
          )}
          <Tooltip
            labelFormatter={(ms) =>
              typeof ms === "number"
                ? new Date(ms).toLocaleString("es-ES", {
                    dateStyle: "medium",
                    timeStyle: "medium",
                  })
                : String(ms)
            }
            formatter={(value) => [
              `${(Number(value ?? 0) * 100).toFixed(1)}%`,
              "",
            ]}
          />
          <Legend />
          {outcomeKeys[0] && (
            <Area
              type="monotone"
              dataKey={outcomeKeys[0].key}
              name={outcomeKeys[0].name}
              fill={`url(#${gradientId})`}
              stroke="none"
              legendType="none"
            />
          )}
          {outcomeKeys.map((o) => (
            <Line
              key={o.key}
              type="monotone"
              dataKey={o.key}
              name={o.name}
              stroke={o.color}
              dot={false}
              strokeWidth={2.5}
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      ) : (
        <div
          className="h-full w-full rounded-md bg-muted/30"
          aria-hidden
        />
      )}
    </div>
  );
}
