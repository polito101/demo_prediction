import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getTenantFromRequest } from "@/lib/tenant";
import { fetchPolymarketLeaderboardTop } from "@/lib/polymarket-leaderboard";
import { fetchTopPlatformTraders } from "@/lib/platform-traders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button-variants";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: "Traders — rankings",
    description:
      "Top traders en Polymarket (global) y ranking interno de paper trading.",
  };
}

function fmtUsd(n: number): string {
  return n.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtUsdSigned(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${fmtUsd(n)}`;
}

export default async function TradersPage() {
  const tenant = await getTenantFromRequest();
  const [polyTop, platformTop] = await Promise.all([
    fetchPolymarketLeaderboardTop(10),
    fetchTopPlatformTraders(tenant.id, 10),
  ]);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Traders</h1>
          <p className="text-muted-foreground">
            Rankings de referencia en Polymarket (datos públicos) y ranking interno
            de esta plataforma (paper trading Polymarket).
          </p>
        </div>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Mercados
        </Link>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Top 10 — Polymarket (global)</h2>
          <p className="text-xs text-muted-foreground">
            Fuente: Data API de Polymarket · periodo ALL · categoría OVERALL · orden
            por PnL.
          </p>
        </div>
        {polyTop.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No se pudo cargar el leaderboard de Polymarket. Inténtalo más tarde.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead className="text-right">PnL</TableHead>
                  <TableHead className="text-right">Volumen</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {polyTop.map((row) => (
                  <TableRow key={row.proxyWallet}>
                    <TableCell className="font-mono text-muted-foreground">
                      {row.rank}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {row.userName?.trim() || "—"}
                      </span>
                      {row.verifiedBadge && (
                        <span className="ml-1 text-xs text-primary" title="Verificado">
                          ✓
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono tabular-nums ${
                        row.pnl > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : row.pnl < 0
                            ? "text-red-600 dark:text-red-400"
                            : ""
                      }`}
                    >
                      {fmtUsdSigned(row.pnl)} USDC
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {fmtUsd(row.vol)} USDC
                    </TableCell>
                    <TableCell>
                      <a
                        href={`https://polymarket.com/profile/${row.proxyWallet}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                          className: "h-8 gap-1 px-2",
                        })}
                      >
                        Perfil
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Top 10 — {tenant.name}</h2>
          <p className="text-xs text-muted-foreground">
            Usuarios con portfolio paper; orden por PnL realizado acumulado (ventas)
            y desempate por volumen negociado.
          </p>
        </div>
        {platformTop.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay datos de paper trading en esta plataforma.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Trader</TableHead>
                  <TableHead className="text-right">PnL realizado</TableHead>
                  <TableHead className="text-right">Volumen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {platformTop.map((row) => (
                  <TableRow key={row.rank}>
                    <TableCell className="font-mono text-muted-foreground">
                      {row.rank}
                    </TableCell>
                    <TableCell className="font-medium">{row.displayName}</TableCell>
                    <TableCell
                      className={`text-right font-mono tabular-nums ${
                        row.realizedPnlUsdc > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : row.realizedPnlUsdc < 0
                            ? "text-red-600 dark:text-red-400"
                            : ""
                      }`}
                    >
                      {fmtUsdSigned(row.realizedPnlUsdc)} USDC
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {fmtUsd(row.volumeUsdc)} USDC
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
