"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PaperPosition } from "@/lib/paper-trading/types";
import { fetchPolymarketMarketByIdClient } from "@/lib/polymarket-client";
import {
  parseClobTokenIds,
  parsePolymarketOutcomes,
} from "@/lib/polymarket";
import { openPolymarketMarketSocket } from "@/lib/polymarket-live-ws";
const IMG = {
  up: "/position-pnl-green.png",
  down: "/position-pnl-red.png",
  flat: "/position-pnl-neutral.png",
} as const;

type LmsrRow = {
  unrealizedPnlUsdc: number;
};

function fmtSignedUsdc(n: number): string {
  const sign = n > 0 ? "+" : "";
  return (
    sign +
    n.toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function signPnl(pnl: number | null, hasSignal: boolean): keyof typeof IMG {
  if (!hasSignal || pnl == null || !Number.isFinite(pnl)) return "flat";
  if (pnl > 0) return "up";
  if (pnl < 0) return "down";
  return "flat";
}

export function HeaderOpenPositionsLive() {
  const [paperPositions, setPaperPositions] = useState<PaperPosition[]>([]);
  const [tokenIdsByMarket, setTokenIdsByMarket] = useState<
    Record<string, string[]>
  >({});
  const [liveByMarket, setLiveByMarket] = useState<
    Record<string, number[] | null>
  >({});
  const [wsNonce, setWsNonce] = useState(0);

  const [lmsrRows, setLmsrRows] = useState<LmsrRow[]>([]);

  const loadPaperPortfolio = useCallback(async () => {
    try {
      const res = await fetch("/api/paper-trading/portfolio", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { positions?: PaperPosition[] };
      const open = (data.positions ?? []).filter((p) => p.shares > 0);
      setPaperPositions(open);
    } catch {
      /* ignore */
    }
  }, []);

  const loadLmsr = useCallback(async () => {
    try {
      const res = await fetch("/api/portfolio/lmsr-live", { cache: "no-store" });
      if (!res.ok) {
        setLmsrRows([]);
        return;
      }
      const data = (await res.json()) as { positions: LmsrRow[] };
      setLmsrRows(data.positions ?? []);
    } catch {
      setLmsrRows([]);
    }
  }, []);

  useEffect(() => {
    const boot = window.setTimeout(() => {
      void loadPaperPortfolio();
      void loadLmsr();
    }, 0);
    const p = window.setInterval(() => void loadPaperPortfolio(), 20_000);
    const l = window.setInterval(() => void loadLmsr(), 8_000);
    return () => {
      window.clearTimeout(boot);
      window.clearInterval(p);
      window.clearInterval(l);
    };
  }, [loadPaperPortfolio, loadLmsr]);

  const marketIds = useMemo(
    () => [...new Set(paperPositions.map((p) => p.marketId))],
    [paperPositions]
  );

  const refreshTokens = useCallback(async () => {
    if (marketIds.length === 0) {
      setTokenIdsByMarket({});
      return;
    }
    const entries = await Promise.all(
      marketIds.map(async (id) => {
        try {
          const market = await fetchPolymarketMarketByIdClient(id);
          if (!market) return [id, [] as string[]] as const;
          const tokens = parseClobTokenIds(market.clobTokenIds);
          const outcomes = parsePolymarketOutcomes(market);
          const n = Math.min(tokens.length, outcomes.length);
          return [id, tokens.slice(0, n)] as const;
        } catch {
          return [id, [] as string[]] as const;
        }
      })
    );
    const next: Record<string, string[]> = {};
    for (const [id, arr] of entries) next[id] = arr;
    setTokenIdsByMarket(next);
    setWsNonce((x) => x + 1);
  }, [marketIds]);

  useEffect(() => {
    const t = window.setTimeout(() => void refreshTokens(), 0);
    return () => window.clearTimeout(t);
  }, [refreshTokens]);

  const assetToSlot = useMemo(() => {
    const m = new Map<string, { marketId: string; outcomeIndex: number }>();
    for (const [marketId, ids] of Object.entries(tokenIdsByMarket)) {
      ids.forEach((assetId, outcomeIndex) => {
        if (assetId) m.set(assetId, { marketId, outcomeIndex });
      });
    }
    return m;
  }, [tokenIdsByMarket]);

  const allAssetIds = useMemo(
    () => [...new Set(Array.from(assetToSlot.keys()))],
    [assetToSlot]
  );

  useEffect(() => {
    if (allAssetIds.length === 0) return;
    const close = openPolymarketMarketSocket({
      assetIds: allAssetIds,
      onPrice: ({ assetId, price }) => {
        const slot = assetToSlot.get(assetId);
        if (!slot) return;
        setLiveByMarket((prev) => {
          const arr = [...(prev[slot.marketId] ?? [])];
          arr[slot.outcomeIndex] = price;
          return { ...prev, [slot.marketId]: arr };
        });
      },
    });
    return close;
  }, [allAssetIds, assetToSlot, wsNonce]);

  const paperTotalPnl = useMemo(() => {
    let total = 0;
    let anyLive = false;
    for (const p of paperPositions) {
      const prices = liveByMarket[p.marketId];
      const live = prices?.[p.outcomeIndex];
      if (live != null && Number.isFinite(live) && live > 0) {
        anyLive = true;
        total += p.shares * (live - p.avgBuyPrice);
      }
    }
    return { total, anyLive };
  }, [paperPositions, liveByMarket]);

  const lmsrTotalPnl = useMemo(() => {
    const total = lmsrRows.reduce((s, r) => s + r.unrealizedPnlUsdc, 0);
    return { total, count: lmsrRows.length };
  }, [lmsrRows]);

  const paperImg = signPnl(
    paperTotalPnl.total,
    paperPositions.length > 0 && paperTotalPnl.anyLive
  );
  const lmsrImg = signPnl(
    lmsrTotalPnl.total,
    lmsrTotalPnl.count > 0
  );

  const paperPnlClass =
    paperTotalPnl.total > 0
      ? "text-emerald-600"
      : paperTotalPnl.total < 0
        ? "text-red-600"
        : "text-muted-foreground";

  const lmsrPnlClass =
    lmsrTotalPnl.total > 0
      ? "text-emerald-600"
      : lmsrTotalPnl.total < 0
        ? "text-red-600"
        : "text-muted-foreground";

  if (paperPositions.length === 0 && lmsrTotalPnl.count === 0) {
    return null;
  }

  return (
    <Link
      href="/portfolio"
      className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-1.5 py-1 pr-2 text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
      title="Posiciones abiertas — PnL no realizado (Polymarket paper en vivo por WebSocket; LMSR cada ~8 s). Pulsa para ir al portfolio."
    >
      {paperPositions.length > 0 && (
        <span className="flex items-center gap-1" title="Polymarket (paper)">
          <span className="hidden sm:inline">PM</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={IMG[paperImg]}
            alt=""
            width={18}
            height={18}
            className="h-[18px] w-[18px] rounded-sm object-cover ring-1 ring-black/10 dark:ring-white/10"
          />
          <span className={`font-mono tabular-nums ${paperPnlClass}`}>
            {paperPositions.length > 0 && paperTotalPnl.anyLive
              ? `${fmtSignedUsdc(paperTotalPnl.total)}`
              : "—"}
          </span>
        </span>
      )}
      {lmsrTotalPnl.count > 0 && (
        <span className="flex items-center gap-1" title="Mercados locales (LMSR)">
          <span className="hidden sm:inline">L</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={IMG[lmsrImg]}
            alt=""
            width={18}
            height={18}
            className="h-[18px] w-[18px] rounded-sm object-cover ring-1 ring-black/10 dark:ring-white/10"
          />
          <span className={`font-mono tabular-nums ${lmsrPnlClass}`}>
            {fmtSignedUsdc(lmsrTotalPnl.total)}
          </span>
        </span>
      )}
    </Link>
  );
}
