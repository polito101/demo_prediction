"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { fetchPolymarketMarketByIdClient } from "@/lib/polymarket-client";
import {
  parseClobTokenIds,
  parsePolymarketOutcomes,
} from "@/lib/polymarket";
import { openPolymarketMarketSocket } from "@/lib/polymarket-live-ws";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type PaperPositionRow = {
  marketId: string;
  marketTitle: string;
  outcomeIndex: number;
  outcomeName: string;
  shares: number;
  avgBuyPrice: number;
};

function fmtUsdc(n: number): string {
  return n.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtSigned(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${fmtUsdc(n)}`;
}

export function PaperPortfolioPositions({
  positions,
}: {
  positions: PaperPositionRow[];
}) {
  const router = useRouter();
  const [liveByMarket, setLiveByMarket] = useState<
    Record<string, number[] | null>
  >({});
  const [tokenIdsByMarket, setTokenIdsByMarket] = useState<
    Record<string, string[]>
  >({});
  const [liveAt, setLiveAt] = useState<number | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [wsNonce, setWsNonce] = useState(0);

  const marketIds = useMemo(
    () => [...new Set(positions.map((p) => p.marketId))],
    [positions]
  );

  const refreshLive = useCallback(async () => {
    if (marketIds.length === 0) {
      setLiveLoading(false);
      return;
    }
    setLiveLoading(true);
    try {
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
    } finally {
      setLiveLoading(false);
    }
  }, [marketIds]);

  useEffect(() => {
    void refreshLive();
  }, [refreshLive]);

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
        setLiveAt(Date.now());
      },
    });
    return close;
  }, [allAssetIds, assetToSlot, wsNonce]);

  const aggregates = useMemo(() => {
    let totalPnl = 0;
    let totalValue = 0;
    for (const p of positions) {
      const prices = liveByMarket[p.marketId];
      const live = prices?.[p.outcomeIndex];
      if (live == null || !Number.isFinite(live)) continue;
      totalPnl += p.shares * (live - p.avgBuyPrice);
      totalValue += p.shares * live;
    }
    return { totalPnl, totalValue };
  }, [positions, liveByMarket]);

  if (positions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tienes posiciones abiertas en Polymarket (paper). Opera desde un
        mercado en la sección Polymarket.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {liveLoading
            ? "Sincronizando stream de precios..."
            : "Precios en vivo por WebSocket"}
          {liveAt != null && !liveLoading && (
            <>
              {" "}
              · última: {new Date(liveAt).toLocaleTimeString("es-ES")}
            </>
          )}
        </span>
        <span className="font-mono">
          Valor posiciones:{" "}
          <span className="text-foreground">{fmtUsdc(aggregates.totalValue)}</span>
          {" · "}
          PnL no realizado:{" "}
          <span
            className={
              aggregates.totalPnl > 0
                ? "text-emerald-600"
                : aggregates.totalPnl < 0
                  ? "text-red-600"
                  : "text-foreground"
            }
          >
            {fmtSigned(aggregates.totalPnl)} USDC
          </span>
        </span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mercado</TableHead>
              <TableHead>Opción</TableHead>
              <TableHead className="text-right">Shares</TableHead>
              <TableHead className="text-right">Precio medio</TableHead>
              <TableHead className="text-right">Precio actual</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">PnL</TableHead>
              <TableHead className="min-w-[200px]">Vender</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((p) => (
              <PaperPositionSellRow
                key={`${p.marketId}-${p.outcomeIndex}`}
                position={p}
                livePrices={liveByMarket[p.marketId]}
                onDone={() => {
                  setWsNonce((x) => x + 1);
                  router.refresh();
                }}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PaperPositionSellRow({
  position,
  livePrices,
  onDone,
}: {
  position: PaperPositionRow;
  livePrices: number[] | null | undefined;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const max = position.shares;

  const live = livePrices?.[position.outcomeIndex];
  const hasLive = live != null && Number.isFinite(live) && live > 0;
  const marketValue = hasLive ? max * live! : null;
  const unrealizedPnl = hasLive ? max * (live! - position.avgBuyPrice) : null;

  async function onSell() {
    const sharesToSell = Number(amount.replace(",", "."));
    if (!Number.isFinite(sharesToSell) || sharesToSell <= 0) {
      toast.error("Indica una cantidad de shares válida.");
      return;
    }
    if (sharesToSell > max + 1e-9) {
      toast.error("No tienes tantas shares en esta posición.");
      return;
    }

    setBusy(true);
    try {
      if (!hasLive) {
        toast.error("No se pudo obtener el precio actual del mercado.");
        return;
      }
      const executionPrice = live!;

      const res = await fetch("/api/paper-trading/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: position.marketId,
          outcomeIndex: position.outcomeIndex,
          sharesToSell,
          executionPrice,
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast.error(err?.error ?? "No se pudo vender.");
        return;
      }

      toast.success("Venta simulada ejecutada.");
      setAmount("");
      onDone();
    } catch {
      toast.error("Error de red al vender.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="max-w-[220px]">
        <Link
          href={`/polymarket/${position.marketId}`}
          className="font-medium text-primary hover:underline"
        >
          {position.marketTitle}
        </Link>
      </TableCell>
      <TableCell>{position.outcomeName}</TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {max.toFixed(6)}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {(position.avgBuyPrice * 100).toFixed(2)}¢
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {hasLive ? `${(live! * 100).toFixed(2)}¢` : "—"}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {marketValue != null ? fmtUsdc(marketValue) : "—"}
      </TableCell>
      <TableCell
        className={`text-right font-mono tabular-nums ${
          unrealizedPnl != null
            ? unrealizedPnl > 0
              ? "text-emerald-600"
              : unrealizedPnl < 0
                ? "text-red-600"
                : ""
            : ""
        }`}
      >
        {unrealizedPnl != null ? fmtSigned(unrealizedPnl) : "—"}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label
              htmlFor={`sell-${position.marketId}-${position.outcomeIndex}`}
              className="text-xs text-muted-foreground"
            >
              Shares (máx. {max.toFixed(4)})
            </Label>
            <Input
              id={`sell-${position.marketId}-${position.outcomeIndex}`}
              type="number"
              min={0.000001}
              max={max}
              step="any"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-[120px]"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="shrink-0"
            disabled={busy}
            onClick={() => setAmount(String(max))}
          >
            Todo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={onSell}
          >
            {busy ? "..." : "Vender"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
