"use client";

import { useEffect, useState } from "react";
import {
  MarketPriceChart,
  type ChartRow,
  type OutcomeKeySpec,
} from "@/components/market-price-chart";

const POLL_MS = 4_000;

export function PolymarketLivePriceChart({
  marketId,
  interval,
  initialData,
  outcomeKeys,
  showMidpointLine,
}: {
  marketId: string;
  interval: string;
  initialData: ChartRow[];
  outcomeKeys: OutcomeKeySpec[];
  showMidpointLine?: boolean;
}) {
  const [data, setData] = useState<ChartRow[]>(initialData);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/polymarket/markets/${encodeURIComponent(marketId)}/history?interval=${encodeURIComponent(interval)}`,
          { cache: "no-store" }
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { chartData?: ChartRow[] };
        if (Array.isArray(json.chartData) && json.chartData.length > 0) {
          setData(json.chartData);
        }
      } catch {
        /* silencioso */
      }
    };
    void poll();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [marketId, interval]);

  return (
    <MarketPriceChart
      data={data}
      outcomeKeys={outcomeKeys}
      showMidpointLine={showMidpointLine}
    />
  );
}
