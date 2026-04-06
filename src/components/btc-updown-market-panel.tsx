"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  mergeBtcUsdPoints,
  type BtcUsdPoint,
} from "@/lib/btc-binance";
import { openPolymarketBtcSocket } from "@/lib/polymarket-live-ws";
import { cn } from "@/lib/utils";

const CHART_H = 320;
/** Ventana visible del eje X: ~30s de precio reciente (deslizante). */
const VIEW_WINDOW_MS = 30_000;
/** Limita el ritmo de renderizado cuando llegan muchos ticks websocket. */
const MIN_APPEND_GAP_MS = 200;
const MAX_LIVE_POINTS = 400;
const LINE_ORANGE = "#f7931a";
/** Rango vertical visible tipo Polymarket (~30 $ de alto a bajo). */
const Y_SPAN_USD = 30;
/** Margen interior: al acercarse a este borde, la “cámara” Y se desplaza. */
const Y_EDGE_PAN_USD = 4;
/** Mezcla al mover el centro Y (0–1); más bajo = transición más suave. */
const Y_CENTER_SMOOTH = 0.22;

/** Suavizado EMA para la línea (el precio mostrado en cabecera sigue siendo crudo del API). */
function emaPrices(prices: number[], alpha: number): number[] {
  if (prices.length === 0) return [];
  const out: number[] = [];
  let e = prices[0]!;
  out.push(e);
  for (let i = 1; i < prices.length; i++) {
    e = alpha * prices[i]! + (1 - alpha) * e;
    out.push(e);
  }
  return out;
}

/** Dos pasadas EMA: menos ruido visual (más parecido a gráficos tipo Polymarket). */
function emaChain(prices: number[], a1: number, a2: number): number[] {
  return emaPrices(emaPrices(prices, a1), a2);
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtCountdown(totalSec: number): string {
  const s = Math.max(0, totalSec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")} MIN ${String(r).padStart(2, "0")} SEG`;
}

type Row = { tMs: number; price: number };

export function BtcUpdownMarketPanel({
  marketId,
  slotStartSec,
  slotEndSec,
  targetPrice,
  initialPoints,
  nextMarkets,
  liveMarketId,
  initialLeftSec,
  initialNowMs,
}: {
  marketId: string;
  slotStartSec: number;
  slotEndSec: number;
  targetPrice: number;
  initialPoints: BtcUsdPoint[];
  nextMarkets: { id: string; label: string }[];
  /** Mercado BTC 5m «en curso» ahora (para volver desde una ventana futura). */
  liveMarketId: string | null;
  /** Snapshot servidor para evitar hydration mismatch en el countdown. */
  initialLeftSec: number;
  /** Snapshot servidor para alinear eje X con el HTML inicial. */
  initialNowMs: number;
}) {
  const slotEndMs = slotEndSec * 1000;
  const [points, setPoints] = useState<Row[]>(() =>
    mergeBtcUsdPoints(initialPoints.map((p) => ({ ...p })))
  );
  const [spot, setSpot] = useState<number | null>(() => {
    const last = initialPoints[initialPoints.length - 1];
    return last?.price ?? null;
  });
  const [leftSec, setLeftSec] = useState(initialLeftSec);
  /** Centro del eje Y: banda fija ~Y_SPAN_USD $; se desplaza al acercarse el precio a los bordes. */
  const [yCenter, setYCenter] = useState(() => {
    const last = initialPoints[initialPoints.length - 1];
    return last?.price ?? targetPrice;
  });

  const wrapRef = useRef<HTMLDivElement>(null);
  const lastAppendRef = useRef(0);
  const [chartWidth, setChartWidth] = useState(0);
  /** Reloj para ventana deslizante de ~30s en el eje X. */
  const [nowMs, setNowMs] = useState(initialNowMs);

  useEffect(() => {
    setPoints(mergeBtcUsdPoints(initialPoints.map((p) => ({ ...p }))));
    const last = initialPoints[initialPoints.length - 1];
    setSpot(last?.price ?? null);
    if (last?.price != null && Number.isFinite(last.price)) {
      setYCenter(last.price);
    }
  }, [initialPoints]);

  useEffect(() => {
    setLeftSec(initialLeftSec);
    setNowMs(initialNowMs);
  }, [marketId, initialLeftSec, initialNowMs]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      if (w > 0) setChartWidth((prev) => (prev === w ? prev : w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNowMs(t);
      setLeftSec(Math.max(0, slotEndSec - Math.floor(t / 1000)));
    }, 500);
    return () => clearInterval(id);
  }, [slotEndSec]);

  useEffect(() => {
    const close = openPolymarketBtcSocket((p, tMs) => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() > slotEndMs + 2_000) return;
      if (tMs - lastAppendRef.current < MIN_APPEND_GAP_MS) return;
      lastAppendRef.current = tMs;
      setSpot(p);
      setPoints((prev) => {
        const next = [...prev, { tMs, price: p }];
        const trimmed =
          next.length > MAX_LIVE_POINTS
            ? next.slice(-MAX_LIVE_POINTS)
            : next;
        return mergeBtcUsdPoints(trimmed).filter(
          (x) => x.tMs <= slotEndMs + 5_000
        );
      });
    });
    return close;
  }, [slotEndMs]);

  const delta = spot != null ? spot - targetPrice : null;

  const windowPoints = useMemo(() => {
    const cut = nowMs - VIEW_WINDOW_MS;
    const inWin = points.filter((p) => p.tMs >= cut);
    if (inWin.length >= 2) return inWin;
    return points.length <= 40 ? points : points.slice(-40);
  }, [points, nowMs]);

  const chartData = useMemo(() => {
    const rows = windowPoints.map((p) => ({ tMs: p.tMs, price: p.price }));
    const raw = rows.map((r) => r.price);
    const smooth = emaChain(raw, 0.11, 0.28);
    return rows.map((r, i) => ({
      tMs: r.tMs,
      price: r.price,
      priceSmooth: smooth[i] ?? r.price,
    }));
  }, [windowPoints]);

  const lastSmooth = chartData.at(-1)?.priceSmooth;

  useEffect(() => {
    if (lastSmooth == null || !Number.isFinite(lastSmooth)) return;
    setYCenter((c) => {
      const half = Y_SPAN_USD / 2;
      const top = c + half;
      const bottom = c - half;
      let targetC = c;
      if (lastSmooth > top - Y_EDGE_PAN_USD) {
        targetC = lastSmooth - half + Y_EDGE_PAN_USD;
      } else if (lastSmooth < bottom + Y_EDGE_PAN_USD) {
        targetC = lastSmooth + half - Y_EDGE_PAN_USD;
      }
      return c + (targetC - c) * Y_CENTER_SMOOTH;
    });
  }, [lastSmooth]);

  const yDomain = useMemo((): [number, number] => {
    const half = Y_SPAN_USD / 2;
    return [yCenter - half, yCenter + half];
  }, [yCenter]);

  const xDomain = useMemo((): [number, number] => {
    if (chartData.length === 0) return [0, 1];
    const tMin = Math.min(...chartData.map((d) => d.tMs));
    const tMax = Math.max(...chartData.map((d) => d.tMs));
    const span = tMax - tMin;
    if (span < VIEW_WINDOW_MS * 0.85) {
      const pad = Math.max(1_500, (VIEW_WINDOW_MS - span) / 2);
      return [tMin - pad, tMax + pad];
    }
    return [nowMs - VIEW_WINDOW_MS, nowMs + 1_500];
  }, [chartData, nowMs]);

  const gradientId = `btc-area-${marketId.replace(/\W/g, "")}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2.5">
          <p className="text-xs font-medium text-zinc-500">Precio a superar (target)</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-zinc-100">
            {fmtUsd(targetPrice)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2.5">
          <p className="text-xs font-medium text-zinc-500">Precio actual (BTC/USD)</p>
          <p
            className="mt-1 font-mono text-lg font-semibold tabular-nums"
            style={{ color: LINE_ORANGE }}
          >
            {spot != null ? fmtUsd(spot) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2.5">
          <p className="text-xs font-medium text-zinc-500">Diferencia vs target</p>
          <p
            className={cn(
              "mt-1 font-mono text-lg font-semibold tabular-nums",
              delta == null
                ? "text-zinc-500"
                : delta >= 0
                  ? "text-emerald-400"
                  : "text-red-400"
            )}
          >
            {delta == null
              ? "—"
              : `${delta >= 0 ? "▲" : "▼"} ${fmtUsd(Math.abs(delta))}`}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2.5">
          <p className="text-xs font-medium text-zinc-500">Tiempo restante</p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-red-400">
            {fmtCountdown(leftSec)}
          </p>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative overflow-hidden rounded-xl border border-zinc-800 bg-[#0e1114] p-3"
        style={{ minHeight: CHART_H }}
      >
        {chartWidth > 0 && chartData.length > 0 ? (
          <ComposedChart
            width={chartWidth}
            height={CHART_H}
            data={chartData}
            margin={{ top: 12, right: 8, left: 4, bottom: 4 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LINE_ORANGE} stopOpacity={0.45} />
                <stop offset="100%" stopColor={LINE_ORANGE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="tMs"
              type="number"
              domain={xDomain}
              tickFormatter={(ms) =>
                new Date(ms as number).toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              }
              stroke="#71717a"
              tick={{ fill: "#a1a1aa", fontSize: 10 }}
              minTickGap={32}
            />
            <YAxis
              domain={yDomain}
              orientation="right"
              tickFormatter={(v) =>
                Number(v).toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                })
              }
              stroke="#71717a"
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              width={72}
            />
            <ReferenceLine
              y={targetPrice}
              stroke="#64748b"
              strokeDasharray="6 6"
              strokeOpacity={0.95}
              label={{
                value: "Target",
                position: "insideTopRight",
                fill: "#94a3b8",
                fontSize: 11,
              }}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.25)", strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as {
                  tMs: number;
                  price: number;
                  priceSmooth: number;
                };
                if (!row) return null;
                return (
                  <div
                    className="rounded-md border border-zinc-600 px-2.5 py-2 text-xs shadow-lg"
                    style={{
                      background: "#18181b",
                    }}
                  >
                    <p className="mb-1 text-[11px] text-zinc-400">
                      {typeof label === "number"
                        ? new Date(label).toLocaleString("es-ES", {
                            dateStyle: "medium",
                            timeStyle: "medium",
                          })
                        : String(label)}
                    </p>
                    <p className="font-mono font-medium text-orange-400">
                      BTC {fmtUsd(row.price)}
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="priceSmooth"
              stroke="none"
              fill={`url(#${gradientId})`}
              legendType="none"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="priceSmooth"
              stroke={LINE_ORANGE}
              strokeWidth={2.5}
              dot={false}
              name="BTC/USD"
              activeDot={{ r: 4, fill: LINE_ORANGE, stroke: "#fff", strokeWidth: 1 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        ) : (
          <div className="flex h-[320px] items-center justify-center text-sm text-zinc-500">
            Cargando precio…
          </div>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-zinc-500">
        La API pública de Polymarket (Gamma) no incluye el precio USD del strike; sí el
        instante de inicio de ventana (eventStartTime). El valor «target» mostrado es la
        apertura de la vela 1m inicial como aproximación. El stream en vivo de BTC/USD
        llega por WebSocket RTDS de Polymarket (tema crypto_prices/btcusdt), con ventana
        móvil de ~30 s, eje Y fijo en ~30 $ y línea suavizada (EMA).
      </p>

      {(nextMarkets.length > 0 ||
        (liveMarketId != null && liveMarketId !== marketId) ||
        (liveMarketId != null && liveMarketId === marketId)) && (
        <div className="flex flex-wrap items-center gap-2">
          {nextMarkets.length > 0 && (
            <span className="text-xs font-medium text-zinc-500">
              Siguientes ventanas
            </span>
          )}
          {nextMarkets.map((m) => (
            <Link
              key={m.id}
              href={`/polymarket/${m.id}?interval=1m`}
              scroll={false}
              className={cn(
                "rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors",
                "hover:border-orange-500/60 hover:bg-zinc-800 hover:text-white"
              )}
            >
              {m.label}
            </Link>
          ))}
          {liveMarketId != null && liveMarketId !== marketId && (
            <Link
              href={`/polymarket/${liveMarketId}?interval=1m`}
              scroll={false}
              className={cn(
                "rounded-full border border-orange-500/70 bg-orange-950/40 px-3 py-1.5 text-xs font-semibold text-orange-200 transition-colors",
                "hover:border-orange-400 hover:bg-orange-950/70 hover:text-white"
              )}
            >
              Mercado en directo
            </Link>
          )}
          {liveMarketId != null && liveMarketId === marketId && (
            <span className="rounded-full border border-zinc-700/80 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-500">
              Estás en la ventana en directo
            </span>
          )}
        </div>
      )}
    </div>
  );
}
