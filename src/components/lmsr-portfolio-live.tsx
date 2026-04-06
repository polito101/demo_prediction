"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = {
  id: string;
  marketId: string;
  marketTitle: string;
  outcomeName: string;
  shares: number;
  avgBuyPrice: number;
  currentPrice: number;
  marketValueUsdc: number;
  unrealizedPnlUsdc: number;
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

export function LmsrPortfolioLive() {
  const [rows, setRows] = useState<Row[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/portfolio/lmsr-live", { cache: "no-store" });
      if (res.status === 401) {
        setError("Sesión requerida");
        setRows([]);
        return;
      }
      if (!res.ok) {
        setError("No se pudieron cargar los precios");
        return;
      }
      const data = (await res.json()) as {
        positions: Row[];
        updatedAt: number;
      };
      setRows(data.positions);
      setUpdatedAt(data.updatedAt);
      setError(null);
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Cargando precios…</p>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay posiciones locales abiertas.
      </p>
    );
  }

  const totalPnl = rows.reduce((s, r) => s + r.unrealizedPnlUsdc, 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Precios LMSR en vivo (actualización cada 15 s)
          {updatedAt != null && (
            <>
              {" "}
              · última: {new Date(updatedAt).toLocaleTimeString("es-ES")}
            </>
          )}
        </span>
        <span className="font-mono">
          PnL no realizado total:{" "}
          <span
            className={
              totalPnl > 0
                ? "text-emerald-600"
                : totalPnl < 0
                  ? "text-red-600"
                  : "text-foreground"
            }
          >
            {fmtSigned(totalPnl)} USDC
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="max-w-[200px] truncate">
                  <Link
                    href={`/markets/${p.marketId}`}
                    className="text-primary hover:underline"
                  >
                    {p.marketTitle}
                  </Link>
                </TableCell>
                <TableCell>{p.outcomeName}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {p.shares.toFixed(4)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {(p.avgBuyPrice * 100).toFixed(2)}¢
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {(p.currentPrice * 100).toFixed(2)}¢
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {fmtUsdc(p.marketValueUsdc)}
                </TableCell>
                <TableCell
                  className={`text-right font-mono tabular-nums ${
                    p.unrealizedPnlUsdc > 0
                      ? "text-emerald-600"
                      : p.unrealizedPnlUsdc < 0
                        ? "text-red-600"
                        : ""
                  }`}
                >
                  {fmtSigned(p.unrealizedPnlUsdc)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
