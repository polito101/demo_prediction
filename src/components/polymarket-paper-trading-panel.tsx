"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { usePaperTrading } from "@/hooks/use-paper-trading";
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

type OutcomeOption = {
  index: number;
  name: string;
  price: number;
};

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
  outcomes,
}: {
  marketId: string;
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
    getOutcomePrices,
    resetPortfolio,
  } = usePaperTrading();

  const [selectedOutcome, setSelectedOutcome] = useState(
    String(outcomes[0]?.index ?? 0)
  );
  const [buyUsdc, setBuyUsdc] = useState("50");
  const [sellSharesAmount, setSellSharesAmount] = useState("10");
  const [prices, setPrices] = useState(outcomes.map((o) => o.price));
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<"buy" | "sell" | null>(null);

  const outcomeIndex = Number(selectedOutcome);
  const selectedMeta = outcomes.find((o) => o.index === outcomeIndex) ?? outcomes[0];
  const currentPrice = prices[outcomeIndex] ?? selectedMeta?.price ?? 0;
  const marketPositions = positions.filter((p) => p.marketId === marketId);
  const selectedPosition = marketPositions.find((p) => p.outcomeIndex === outcomeIndex);
  const recentHistory = useMemo(() => history.slice(0, 12), [history]);

  async function refreshPrices() {
    setRefreshing(true);
    try {
      const latest = await getOutcomePrices(marketId);
      if (!latest.length) {
        toast.error("No se pudieron actualizar precios.");
        return;
      }
      setPrices(latest);
      toast.success("Precios sincronizados.");
    } catch {
      toast.error("Error al consultar precios en tiempo real.");
    } finally {
      setRefreshing(false);
    }
  }

  async function onBuy() {
    const usdcAmount = Number(buyUsdc);
    if (!Number.isFinite(usdcAmount) || usdcAmount <= 0) {
      toast.error("Introduce un importe válido mayor que 0.");
      return;
    }
    setBusy("buy");
    try {
      const latest = await getOutcomePrices(marketId);
      if (!latest.length) {
        toast.error("No se pudo obtener el precio del mercado (revisa la conexión).");
        return;
      }
      const executionPrice = latest[outcomeIndex];
      if (!Number.isFinite(executionPrice) || executionPrice <= 0) {
        toast.error("Precio inválido para comprar.");
        return;
      }
      setPrices(latest);
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
      const latest = await getOutcomePrices(marketId);
      if (!latest.length) {
        toast.error("No se pudo obtener el precio del mercado (revisa la conexión).");
        return;
      }
      const executionPrice = latest[outcomeIndex];
      if (!Number.isFinite(executionPrice) || executionPrice <= 0) {
        toast.error("Precio inválido para vender.");
        return;
      }
      setPrices(latest);
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

  async function onReset() {
    const res = await resetPortfolio();
    if (!res.ok) {
      toast.error("No se pudo resetear el portfolio en la base de datos.");
      return;
    }
    toast.success("Portfolio reseteado.");
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
            onClick={refreshPrices}
            disabled={refreshing}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {refreshing ? "Actualizando..." : "Actualizar precio"}
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
                  <SelectTrigger>
                    <SelectValue />
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

          <Button variant="ghost" onClick={onReset}>
            Reset portfolio DB
          </Button>
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
            <ul className="space-y-2">
              {marketPositions.map((p) => (
                (() => {
                  const livePrice = prices[p.outcomeIndex] ?? outcomes[p.outcomeIndex]?.price ?? 0;
                  const unrealizedPnl = p.shares * (livePrice - p.avgBuyPrice);
                  return (
                    <li
                      key={p.id}
                      className="rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="font-medium">{p.outcomeName}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          actual: {(livePrice * 100).toFixed(2)}¢
                        </span>
                      </div>
                      <div className="grid gap-1.5 sm:grid-cols-4">
                        <div className="font-mono">shares: {p.shares.toFixed(6)}</div>
                        <div className="font-mono">avg: {(p.avgBuyPrice * 100).toFixed(2)}¢</div>
                        <div className="font-mono">notional: {fmtUsdc(p.shares * livePrice)}</div>
                        <div
                          className={
                            unrealizedPnl > 0
                              ? "font-mono text-emerald-600"
                              : unrealizedPnl < 0
                                ? "font-mono text-red-600"
                                : "font-mono text-muted-foreground"
                          }
                        >
                          PnL no realizado: {fmtSignedUsdc(unrealizedPnl)}
                        </div>
                      </div>
                    </li>
                  );
                })()
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de transacciones</CardTitle>
        </CardHeader>
        <CardContent>
          {recentHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay operaciones.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentHistory.map((h) => (
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
