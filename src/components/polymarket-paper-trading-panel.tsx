"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { usePaperTrading } from "@/hooks/use-paper-trading";
import { openPolymarketMarketSocket } from "@/lib/polymarket-live-ws";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaperPosition } from "@/lib/paper-trading/types";

type OutcomeOption = {
  index: number;
  name: string;
  price: number;
};

/**
 * Precio en vivo para un `outcomeIndex` lógico: `prices` va en el mismo orden que `outcomes`.
 * Devuelve null si el outcome no existe en esta vista o no hay precio válido (evita usar 0 y PnL falso).
 */
function livePriceForOutcome(
  prices: number[],
  outcomes: OutcomeOption[],
  outcomeIndex: number
): number | null {
  const idx = outcomes.findIndex((o) => o.index === outcomeIndex);
  if (idx < 0 || idx >= prices.length) return null;
  const fromPoll = prices[idx];
  if (Number.isFinite(fromPoll) && fromPoll > 0) return fromPoll;
  const fallback = outcomes[idx]?.price;
  if (Number.isFinite(fallback) && fallback > 0) return fallback;
  return null;
}

function fmtUsdc(v: number): string {
  return v.toLocaleString("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtSignedUsdc(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${fmtUsdc(v)}`;
}

export function PolymarketPaperTradingPanel({
  marketId,
  clobTokenIds,
  outcomes,
}: {
  marketId: string;
  clobTokenIds: string[];
  outcomes: OutcomeOption[];
}) {
  const {
    hydrated,
    loadError,
    balance,
    positions,
    history,
    buyPosition,
    sellPosition,
  } = usePaperTrading();

  const [selectedOutcome, setSelectedOutcome] = useState(
    String(outcomes[0]?.index ?? 0)
  );
  const [buyUsdc, setBuyUsdc] = useState("50");
  const [sellSharesAmount, setSellSharesAmount] = useState("10");
  const [prices, setPrices] = useState(outcomes.map((o) => o.price));
  const [refreshing, setRefreshing] = useState(false);
  const [wsNonce, setWsNonce] = useState(0);
  const [busy, setBusy] = useState<"buy" | "sell" | null>(null);
  const [rowSellAmount, setRowSellAmount] = useState<Record<string, string>>({});
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);
  const idToIndex = useMemo(
    () => new Map(clobTokenIds.map((id, i) => [id, i])),
    [clobTokenIds]
  );

  const outcomeIndex = Number(selectedOutcome);
  const selectedMeta = outcomes.find((o) => o.index === outcomeIndex) ?? outcomes[0];
  const currentPrice =
    livePriceForOutcome(prices, outcomes, outcomeIndex) ?? selectedMeta?.price ?? 0;
  const marketPositions = positions.filter((p) => p.marketId === marketId);
  const selectedPosition = marketPositions.find((p) => p.outcomeIndex === outcomeIndex);
  const marketHistory = useMemo(
    () =>
      history
        .filter((h) => h.marketId === marketId)
        .sort((a, b) => b.timestamp - a.timestamp),
    [history, marketId]
  );

  useEffect(() => {
    setPrices(outcomes.map((o) => o.price));
  }, [marketId, outcomes]);

  useEffect(() => {
    if (clobTokenIds.length === 0) return;
    const close = openPolymarketMarketSocket({
      assetIds: clobTokenIds,
      onPrice: ({ assetId, price }) => {
        const idx = idToIndex.get(assetId);
        if (idx == null) return;
        setPrices((prev) => {
          if (idx < 0 || idx >= prev.length) return prev;
          const next = [...prev];
          next[idx] = price;
          return next;
        });
      },
    });
    return close;
  }, [clobTokenIds, idToIndex, wsNonce]);

  async function refreshPrices() {
    setRefreshing(true);
    setWsNonce((x) => x + 1);
    setTimeout(() => setRefreshing(false), 450);
    toast.success("Reconectando stream de precios...");
  }

  async function onBuy() {
    const usdcAmount = Number(buyUsdc);
    if (!Number.isFinite(usdcAmount) || usdcAmount <= 0) {
      toast.error("Introduce un importe válido mayor que 0.");
      return;
    }
    setBusy("buy");
    try {
      const executionPrice = livePriceForOutcome(prices, outcomes, outcomeIndex);
      if (executionPrice == null) {
        toast.error(
          "Precio no disponible para este outcome (índice fuera de rango o mercado desincronizado)."
        );
        return;
      }
      const res = await buyPosition({
        marketId,
        outcomeIndex,
        outcomeName: selectedMeta?.name ?? `Outcome ${outcomeIndex}`,
        usdcAmount,
        executionPrice,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Compra simulada ejecutada.");
    } catch {
      toast.error("No se pudo ejecutar la compra. Inténtalo de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  async function onSell() {
    const sharesToSell = Number(sellSharesAmount);
    if (!Number.isFinite(sharesToSell) || sharesToSell <= 0) {
      toast.error("Introduce una cantidad de shares válida.");
      return;
    }
    setBusy("sell");
    try {
      const executionPrice = livePriceForOutcome(prices, outcomes, outcomeIndex);
      if (executionPrice == null) {
        toast.error(
          "Precio no disponible para este outcome (índice fuera de rango o mercado desincronizado)."
        );
        return;
      }
      const res = await sellPosition({
        marketId,
        outcomeIndex,
        sharesToSell,
        executionPrice,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Venta simulada ejecutada.");
    } catch {
      toast.error("No se pudo ejecutar la venta.");
    } finally {
      setBusy(null);
    }
  }

  async function sellPositionRow(p: PaperPosition, sharesToSell: number) {
    if (!Number.isFinite(sharesToSell) || sharesToSell <= 0) {
      toast.error("Indica una cantidad de shares válida.");
      return;
    }
    if (sharesToSell > p.shares + 1e-9) {
      toast.error("No puedes vender más shares de los que tienes.");
      return;
    }
    setClosingPositionId(p.id);
    try {
      const executionPrice = livePriceForOutcome(prices, outcomes, p.outcomeIndex);
      if (executionPrice == null) {
        toast.error(
          "Precio no disponible para este outcome (índice fuera de rango o mercado desincronizado)."
        );
        return;
      }
      const res = await sellPosition({
        marketId: p.marketId,
        outcomeIndex: p.outcomeIndex,
        sharesToSell,
        executionPrice,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Posición actualizada.");
      setRowSellAmount((prev) => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });
    } catch {
      toast.error("No se pudo ejecutar la venta.");
    } finally {
      setClosingPositionId(null);
    }
  }

  if (!hydrated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Paper trading</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Cargando portfolio local...
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Paper trading (persistencia DB)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{loadError}</p>
          <Link href="/login" className="text-primary underline">
            Ir a iniciar sesión
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (outcomes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Paper trading (local)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Este mercado no tiene outcomes disponibles para operar.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Paper trading (local)</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshPrices()}
            disabled={refreshing || clobTokenIds.length === 0}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {refreshing ? "Reconectando..." : "Reconectar stream"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Balance ficticio</p>
              <p className="text-lg font-semibold tabular-nums">{fmtUsdc(balance)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Precio actual seleccionado</p>
              <p className="text-lg font-semibold tabular-nums">
                {(currentPrice * 100).toFixed(2)}¢
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-md border p-3">
              <h3 className="font-medium">Comprar</h3>
              <div className="space-y-2">
                <Label>Outcome</Label>
                <Select
                  value={selectedOutcome}
                  onValueChange={(value) => {
                    if (value) setSelectedOutcome(value);
                  }}
                >
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="Elige una opción">
                      {selectedMeta?.name ?? "—"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {outcomes.map((o) => (
                      <SelectItem key={o.index} value={String(o.index)}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="buy-usdc">Importe USDC</Label>
                <Input
                  id="buy-usdc"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={buyUsdc}
                  onChange={(e) => setBuyUsdc(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={onBuy} disabled={busy !== null}>
                {busy === "buy" ? "Comprando..." : "Comprar"}
              </Button>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <h3 className="font-medium">Vender</h3>
              <div className="space-y-2">
                <Label htmlFor="sell-shares">Shares a vender</Label>
                <Input
                  id="sell-shares"
                  type="number"
                  min={0.000001}
                  step={0.000001}
                  value={sellSharesAmount}
                  onChange={(e) => setSellSharesAmount(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Disponibles en este outcome:{" "}
                <span className="font-mono">
                  {(selectedPosition?.shares ?? 0).toFixed(6)}
                </span>
              </p>
              <Button
                variant="secondary"
                className="w-full"
                onClick={onSell}
                disabled={busy !== null}
              >
                {busy === "sell" ? "Vendiendo..." : "Vender"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Posiciones abiertas (este mercado)</CardTitle>
        </CardHeader>
        <CardContent>
          {marketPositions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay posiciones abiertas en este mercado.
            </p>
          ) : (
            <ul className="space-y-3">
              {marketPositions.map((p) => {
                const livePrice = livePriceForOutcome(prices, outcomes, p.outcomeIndex);
                const unrealizedPnl =
                  livePrice != null
                    ? p.shares * (livePrice - p.avgBuyPrice)
                    : null;
                const rowKey = p.id;
                const rowAmt = rowSellAmount[rowKey] ?? "";
                const rowBusy = closingPositionId === p.id;
                const panelBusy = busy !== null || closingPositionId !== null;

                return (
                  <li
                    key={p.id}
                    className="rounded-md border px-3 py-3 text-sm"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{p.outcomeName}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        actual:{" "}
                        {livePrice != null
                          ? `${(livePrice * 100).toFixed(2)}¢`
                          : "— (sin precio para este outcome)"}
                      </span>
                    </div>
                    <div className="mb-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="font-mono">
                        shares: {p.shares.toFixed(6)}
                      </div>
                      <div className="font-mono">
                        avg: {(p.avgBuyPrice * 100).toFixed(2)}¢
                      </div>
                      <div className="font-mono">
                        notional:{" "}
                        {livePrice != null
                          ? fmtUsdc(p.shares * livePrice)
                          : "—"}
                      </div>
                      <div
                        className={
                          unrealizedPnl == null
                            ? "font-mono text-muted-foreground"
                            : unrealizedPnl > 0
                              ? "font-mono text-emerald-600"
                              : unrealizedPnl < 0
                                ? "font-mono text-red-600"
                                : "font-mono text-muted-foreground"
                        }
                      >
                        PnL no realizado:{" "}
                        {unrealizedPnl != null
                          ? fmtSignedUsdc(unrealizedPnl)
                          : "—"}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-2 border-t pt-3">
                      <div className="space-y-1">
                        <Label
                          className="text-xs text-muted-foreground"
                          htmlFor={`row-sell-${rowKey}`}
                        >
                          Vender shares
                        </Label>
                        <Input
                          id={`row-sell-${rowKey}`}
                          type="number"
                          min={0.000001}
                          max={p.shares}
                          step="any"
                          placeholder="0"
                          value={rowAmt}
                          disabled={panelBusy}
                          onChange={(e) =>
                            setRowSellAmount((prev) => ({
                              ...prev,
                              [rowKey]: e.target.value,
                            }))
                          }
                          className="w-[130px]"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={panelBusy}
                        onClick={() =>
                          setRowSellAmount((prev) => ({
                            ...prev,
                            [rowKey]: String(p.shares),
                          }))
                        }
                      >
                        Todo
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={panelBusy}
                        onClick={() =>
                          void sellPositionRow(
                            p,
                            Number((rowAmt || "0").replace(",", "."))
                          )
                        }
                      >
                        {rowBusy ? "…" : "Vender"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={panelBusy}
                        onClick={() => void sellPositionRow(p, p.shares)}
                      >
                        {rowBusy ? "…" : "Cerrar posición"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de transacciones (este mercado)</CardTitle>
        </CardHeader>
        <CardContent>
          {marketHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay operaciones en este mercado.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {marketHistory.map((h) => (
                <li
                  key={h.id}
                  className="rounded-md border px-3 py-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium uppercase">{h.type}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(h.timestamp).toLocaleString("es-ES")}
                    </span>
                  </div>
                  <p>
                    {h.outcomeName} · {h.shares.toFixed(6)} shares @{" "}
                    {(h.price * 100).toFixed(2)}¢
                  </p>
                  <p className="text-xs text-muted-foreground">
                    USDC: {fmtUsdc(h.usdcAmount)}
                    {h.realizedPnl != null ? ` · PnL: ${fmtUsdc(h.realizedPnl)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
