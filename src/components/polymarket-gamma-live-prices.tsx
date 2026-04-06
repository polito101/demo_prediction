"use client";

import { useEffect, useMemo, useState } from "react";
import { openPolymarketMarketSocket } from "@/lib/polymarket-live-ws";

const COLORS = ["#6366f1", "#22c55e", "#f97316", "#ec4899", "#06b6d4", "#eab308"];

export function PolymarketGammaLivePrices({
  marketId,
  clobTokenIds,
  initialOutcomes,
}: {
  marketId: string;
  /** Si hay tokens CLOB, se usa midpoint del libro (más en vivo). */
  clobTokenIds: string[];
  initialOutcomes: { name: string; price: number }[];
}) {
  const [rows, setRows] = useState(initialOutcomes);
  const idToIndex = useMemo(
    () => new Map(clobTokenIds.map((id, i) => [id, i])),
    [clobTokenIds]
  );

  useEffect(() => {
    setRows(initialOutcomes);
  }, [marketId, initialOutcomes]);

  useEffect(() => {
    if (clobTokenIds.length === 0) return;
    const close = openPolymarketMarketSocket({
      assetIds: clobTokenIds,
      onPrice: ({ assetId, price }) => {
        const idx = idToIndex.get(assetId);
        if (idx == null) return;
        setRows((prev) => {
          if (idx < 0 || idx >= prev.length) return prev;
          const next = [...prev];
          const old = next[idx];
          if (!old) return prev;
          if (Math.abs(old.price - price) < 0.000_1) return prev;
          next[idx] = { ...old, price };
          return next;
        });
      },
    });
    return close;
  }, [clobTokenIds, idToIndex]);

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {rows.map((o, i) => (
        <li
          key={`${marketId}-gamma-o-${i}`}
          className="flex items-center justify-between rounded-md border px-3 py-2"
        >
          <span>{o.name}</span>
          <span
            className="font-mono font-semibold"
            style={{ color: COLORS[i % COLORS.length] }}
          >
            {(o.price * 100).toFixed(1)}¢
          </span>
        </li>
      ))}
    </ul>
  );
}
