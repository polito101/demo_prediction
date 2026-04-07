"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BtcUsdPoint } from "@/lib/btc-binance";
import { BtcUpdownSpotChart } from "@/components/btc-updown-spot-chart";
import { cn } from "@/lib/utils";

const LINE_ORANGE = "#f7931a";

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
  slotEndSec,
  targetPrice,
  initialPoints,
  nextMarkets,
  liveMarketId,
  initialLeftSec,
  initialNowMs,
}: {
  marketId: string;
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
  const [points] = useState<Row[]>(
    () => initialPoints.map((p) => ({ tMs: p.tMs, price: p.price }))
  );
  const [spot, setSpot] = useState<number | null>(() => {
    const last = initialPoints[initialPoints.length - 1];
    return last?.price ?? null;
  });
  const [leftSec, setLeftSec] = useState(initialLeftSec);
  const lastLiveAtRef = useRef<number | null>(null);
  const pollInFlightRef = useRef(false);
  const pendingSpotRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const last = initialPoints[initialPoints.length - 1];
      setSpot(last?.price ?? null);
      if (last?.price != null) lastLiveAtRef.current = Date.now();
    }, 0);
    return () => window.clearTimeout(t);
  }, [initialPoints]);

  useEffect(() => {
    const t = window.setTimeout(() => setLeftSec(initialLeftSec), 0);
    return () => window.clearTimeout(t);
  }, [marketId, initialLeftSec, initialNowMs]);

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setLeftSec(Math.max(0, slotEndSec - Math.floor(t / 1000)));
    }, 500);
    return () => clearInterval(id);
  }, [slotEndSec]);

  useEffect(() => {
    const slotEndMs = slotEndSec * 1000;
    let closed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let reconnectMs = 1_000;

    const flushSpot = () => {
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const next = pendingSpotRef.current;
        if (next == null) return;
        pendingSpotRef.current = null;
        setSpot(next);
      });
    };

    const pushSpot = (price: number) => {
      if (!Number.isFinite(price) || price <= 0) return;
      lastLiveAtRef.current = Date.now();
      pendingSpotRef.current = price;
      flushSpot();
    };

    const connect = () => {
      if (closed) return;
      ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@trade");
      ws.onopen = () => {
        reconnectMs = 1_000;
      };
      ws.onmessage = (ev) => {
        if (document.visibilityState !== "visible") return;
        if (Date.now() > slotEndMs + 2_000) return;
        const raw = ev.data;
        if (typeof raw !== "string") return;
        try {
          const msg = JSON.parse(raw) as { p?: string };
          const price = msg.p ? Number.parseFloat(msg.p) : NaN;
          pushSpot(price);
        } catch {
          return;
        }
      };
      ws.onerror = () => ws?.close();
      ws.onclose = () => {
        if (closed) return;
        reconnectTimer = window.setTimeout(connect, reconnectMs);
        reconnectMs = Math.min(10_000, Math.round(reconnectMs * 1.7));
      };
    };

    connect();
    return () => {
      closed = true;
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [slotEndSec]);

  useEffect(() => {
    // Fallback si el WS no entrega.
    const id = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() > slotEndSec * 1000 + 2_000) return;
      const last = lastLiveAtRef.current;
      const stale = last == null || Date.now() - last > 3_000;
      if (!stale || pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        const res = await fetch("/api/btc/spot", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { price?: number };
        const price = typeof json.price === "number" ? json.price : null;
        if (price == null || !Number.isFinite(price) || price <= 0) return;
        lastLiveAtRef.current = Date.now();
        setSpot(price);
      } finally {
        pollInFlightRef.current = false;
      }
    }, 1_000);
    return () => window.clearInterval(id);
  }, [slotEndSec]);

  const delta = spot != null ? spot - targetPrice : null;

  const chartPoints = useMemo(() => {
    // Unimos (dedup) para un seed más limpio del chart, pero el streaming va por socket.
    const m = new Map<number, number>();
    for (const p of points) m.set(p.tMs, p.price);
    return Array.from(m.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([tMs, price]) => ({ tMs, price }));
  }, [points]);

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

      <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-[#0e1114] p-3">
        <BtcUpdownSpotChart
          marketId={marketId}
          targetPrice={targetPrice}
          initialPoints={chartPoints}
          slotEndSec={slotEndSec}
        />
      </div>

      <p className="text-[11px] leading-relaxed text-zinc-500">
        La API pública de Polymarket (Gamma) no incluye el precio USD del strike; sí el
        instante de inicio de ventana (eventStartTime). El valor «target» mostrado es la
        apertura de la vela 1m inicial como aproximación. El stream en vivo de BTC/USD
        llega por WebSocket (Binance trades) + fallback, con ventana móvil de 60 s y eje Y
        autoajustado para ver micro-movimientos.
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
