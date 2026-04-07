"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ColorType,
  createChart,
  CrosshairMode,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type AutoscaleInfoProvider,
  type UTCTimestamp,
} from "lightweight-charts";
import type { BtcUsdPoint } from "@/lib/btc-binance";
import { openPolymarketBtcSocket } from "@/lib/polymarket-live-ws";

type LinePoint = { time: UTCTimestamp; value: number };

const LINE_ORANGE = "#f7931a";
const BG = "#0e1114";
/** Deja espacio “vacío” a la derecha para suavizar el scroll visual. */
const RIGHT_PAD_MS = 4_000;

function toUtcSeconds(tMs: number): UTCTimestamp {
  return Math.floor(tMs / 1000) as UTCTimestamp;
}

function clampLastMinute(nowMs: number, points: BtcUsdPoint[]): LinePoint[] {
  const cut = nowMs - 60_000;
  const out: LinePoint[] = [];
  for (const p of points) {
    const tMs = p.tMs;
    if (tMs < cut) continue;
    if (!Number.isFinite(p.price)) continue;
    out.push({ time: toUtcSeconds(tMs), value: p.price });
  }
  // Dedup por segundo (nos quedamos con el último tick de cada segundo).
  out.sort((a, b) => a.time - b.time);
  const dedup: LinePoint[] = [];
  for (const pt of out) {
    const last = dedup[dedup.length - 1];
    if (last && last.time === pt.time) last.value = pt.value;
    else dedup.push(pt);
  }
  return dedup;
}

function lastMinuteRange(nowMs: number) {
  const to = toUtcSeconds(nowMs + RIGHT_PAD_MS);
  const from = toUtcSeconds(nowMs - 60_000);
  return { from, to };
}

function safeSetVisibleLastMinute(chart: IChartApi, nowMs: number): void {
  try {
    chart.timeScale().setVisibleRange(lastMinuteRange(nowMs));
  } catch {
    // Puede fallar si aún no hay datos para mapear el rango a índices lógicos.
  }
}

export function BtcUpdownSpotChart({
  marketId,
  targetPrice,
  initialPoints,
  slotEndSec,
  onSpot,
}: {
  marketId: string;
  targetPrice: number;
  initialPoints: BtcUsdPoint[];
  slotEndSec: number;
  onSpot?: (price: number, tMs: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const dataRef = useRef<LinePoint[]>([]);
  const lastSecRef = useRef<UTCTimestamp | null>(null);
  const lastLiveAtRef = useRef<number | null>(null);
  const pollInFlightRef = useRef(false);
  const binanceWsRef = useRef<WebSocket | null>(null);
  const pendingTickRef = useRef<{ price: number; tMs: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFlushAtRef = useRef(0);
  const lastSpotNotifyAtRef = useRef<number | null>(null);

  const applyTick = useCallback(
    (price: number, tMs: number) => {
    if (!Number.isFinite(price) || price <= 0) return;
    lastLiveAtRef.current = Date.now();

    const tSec = toUtcSeconds(tMs);
    const data = dataRef.current;
    const lastSec = lastSecRef.current;

      // Lightweight Charts solo permite `update()` sobre el último punto o añadir uno nuevo.
      // Si llegan ticks fuera de orden (mezcla de feeds), ignora los más antiguos.
      if (lastSec != null && tSec < lastSec) return;

    if (lastSec != null && tSec === lastSec && data.length) {
      data[data.length - 1] = { time: tSec, value: price };
    } else {
      data.push({ time: tSec, value: price });
      lastSecRef.current = tSec;
    }

    const nowMs = Date.now();
    const cutSec = toUtcSeconds(nowMs - 60_000);
    while (data.length && data[0]!.time < cutSec) data.shift();

    if (data.length === 1) {
      // Primera muestra: usa setData para inicializar el buffer interno.
      seriesRef.current?.setData([{ time: tSec, value: price }]);
    } else {
      seriesRef.current?.update({ time: tSec, value: price });
    }
    if (dataRef.current.length > 0 && chartRef.current) {
      safeSetVisibleLastMinute(chartRef.current, nowMs);
    }
      if (onSpot) {
        const last = lastSpotNotifyAtRef.current;
        if (last == null || nowMs - last >= 150) {
          lastSpotNotifyAtRef.current = nowMs;
          onSpot(price, tMs);
        }
      }
    },
    [onSpot]
  );

  const scheduleFlush = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const tick = pendingTickRef.current;
      if (!tick) return;
      pendingTickRef.current = null;

      // Limita a ~30 fps para evitar “trompicones” por exceso de updates.
      const now = performance.now();
      if (now - lastFlushAtRef.current < 33) {
        pendingTickRef.current = tick;
        scheduleFlush();
        return;
      }
      lastFlushAtRef.current = now;
      applyTick(tick.price, tick.tMs);
    });
  }, [applyTick]);

  const pushTick = useCallback(
    (price: number, tMs: number) => {
    if (!Number.isFinite(price) || price <= 0) return;
    pendingTickRef.current = { price, tMs };
    scheduleFlush();
    },
    [scheduleFlush]
  );

  const initial = useMemo(() => {
    const seedNow = Date.now();
    return clampLastMinute(seedNow, initialPoints);
  }, [initialPoints]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: BG },
        textColor: "#a1a1aa",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
        fontSize: 12,
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderVisible: false,
        secondsVisible: true,
        timeVisible: true,
        rightOffset: 6,
        barSpacing: 6,
        fixLeftEdge: true,
        fixRightEdge: true,
        lockVisibleTimeRangeOnResize: true,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(255,255,255,0.18)", width: 1, style: 0 },
        horzLine: { color: "rgba(255,255,255,0.18)", width: 1, style: 0 },
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(LineSeries, {
      color: LINE_ORANGE,
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      autoscaleInfoProvider: ((original) => {
        const info = original();
        const data = dataRef.current;
        if (!data.length) return info;
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        for (const p of data) {
          if (p.value < min) min = p.value;
          if (p.value > max) max = p.value;
        }
        if (!Number.isFinite(min) || !Number.isFinite(max)) return info;
        const span = Math.max(0.01, max - min);
        const pad = Math.max(0.5, span * 0.12);
        return {
          priceRange: { minValue: min - pad, maxValue: max + pad },
        };
      }) satisfies AutoscaleInfoProvider,
    });

    // Línea target (strike/open de la ventana)
    series.createPriceLine({
      price: targetPrice,
      color: "#94a3b8",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "Target",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Seed inicial
    dataRef.current = initial;
    lastSecRef.current = initial.length ? initial[initial.length - 1]!.time : null;
    series.setData(initial);
    safeSetVisibleLastMinute(chart, Date.now());

    const ro = new ResizeObserver(() => {
      if (dataRef.current.length > 0) safeSetVisibleLastMinute(chart, Date.now());
    });
    ro.observe(el);

    const clock = window.setInterval(() => {
      // Mueve la ventana aunque no haya ticks (efecto “último minuto” siempre vivo).
      // A ritmo moderado para evitar jitter visual.
      if (dataRef.current.length > 0) safeSetVisibleLastMinute(chart, Date.now());
    }, 500);

    return () => {
      window.clearInterval(clock);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId, targetPrice]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    // Si cambian los puntos iniciales (navegación), resincronizamos.
    dataRef.current = initial;
    lastSecRef.current = initial.length ? initial[initial.length - 1]!.time : null;
    series.setData(initial);
    if (dataRef.current.length > 0) safeSetVisibleLastMinute(chart, Date.now());
  }, [initial]);

  useEffect(() => {
    const slotEndMs = slotEndSec * 1000;
    const close = openPolymarketBtcSocket((price, tMs) => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() > slotEndMs + 2_000) return;
      pushTick(price, tMs);
    });
    return close;
  }, [slotEndSec, pushTick]);

  useEffect(() => {
    // Feed más dinámico: Binance trades (muchos ticks por segundo).
    // Esto hace que la línea se mueva de forma continua en Y (aunque el eje X va por segundos).
    const slotEndMs = slotEndSec * 1000;
    let closed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let reconnectMs = 1_000;

    const connect = () => {
      if (closed) return;
      ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@trade");
      binanceWsRef.current = ws;
      ws.onopen = () => {
        reconnectMs = 1_000;
      };
      ws.onmessage = (ev) => {
        if (document.visibilityState !== "visible") return;
        if (Date.now() > slotEndMs + 2_000) return;
        const raw = ev.data;
        if (typeof raw !== "string") return;
        try {
          const msg = JSON.parse(raw) as { p?: string; T?: number };
          const price = msg.p ? Number.parseFloat(msg.p) : NaN;
          const tMs = typeof msg.T === "number" ? msg.T : Date.now();
          if (!Number.isFinite(price) || price <= 0) return;
          pushTick(price, tMs);
        } catch {
          return;
        }
      };
      ws.onerror = () => {
        ws?.close();
      };
      ws.onclose = () => {
        if (closed) return;
        reconnectTimer = window.setTimeout(connect, reconnectMs);
        reconnectMs = Math.min(10_000, Math.round(reconnectMs * 1.7));
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      ws?.close();
      binanceWsRef.current = null;
    };
  }, [slotEndSec, pushTick]);

  useEffect(() => {
    // Fallback: si el WS no entrega ticks, hacemos polling del spot vía API (server->Binance).
    const id = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() > slotEndSec * 1000 + 2_000) return;
      const last = lastLiveAtRef.current;
      const stale = last == null || Date.now() - last > 3_000;
      if (!stale) return;
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        const res = await fetch("/api/btc/spot", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { price?: number; tMs?: number };
        const price = typeof json.price === "number" ? json.price : null;
        const tMs = typeof json.tMs === "number" ? json.tMs : Date.now();
        if (price == null) return;
        pushTick(price, tMs);
      } finally {
        pollInFlightRef.current = false;
      }
    }, 1_000);
    return () => window.clearInterval(id);
  }, [slotEndSec, pushTick]);

  return <div ref={containerRef} className="h-[320px] w-full" />;
}

