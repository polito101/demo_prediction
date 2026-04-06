import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

function fmtUsdc(n: number): string {
  return n.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)} %`;
}

function SignedValue({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const positive = value > 0;
  const negative = value < 0;
  return (
    <span
      className={cn(
        "font-mono font-semibold tabular-nums",
        positive && "text-emerald-600 dark:text-emerald-400",
        negative && "text-red-600 dark:text-red-400",
        !positive && !negative && "text-foreground",
        className
      )}
    >
      {positive ? "+" : ""}
      {fmtUsdc(value)} USDC
    </span>
  );
}

export type PortfolioStatsModel = {
  paper: {
    initialBalanceUsdc: number;
    balanceUsdc: number;
    volumeUsdc: number;
    realizedPnlUsdc: number;
    tradeCount: number;
    /** max(0, inicial − patrimonio a coste): sólo pérdida vs capital inicial. */
    lossVsInitialUsdc: number;
    /** (equityAtCost − inicial) / inicial. */
    roiVsInitialPct: number | null;
  };
  lmsr: {
    balanceUsdc: number;
    volumeUsdc: number;
    tradeCount: number;
  };
};

export function PortfolioStats({ paper, lmsr }: { paper: PortfolioStatsModel["paper"]; lmsr: PortfolioStatsModel["lmsr"] }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Resumen de estadísticas</h2>
        <p className="text-sm text-muted-foreground">
          Polymarket paper: volumen y PnL realizado vienen del historial en base de
          datos; pérdidas y ROI vs capital inicial usan el mismo criterio a coste
          (efectivo + shares × precio medio), sin precios de mercado en vivo.
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Polymarket — paper trading
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card size="sm">
            <CardHeader>
              <CardDescription>Volumen negociado</CardDescription>
              <CardTitle className="font-mono text-xl tabular-nums">
                {fmtUsdc(paper.volumeUsdc)} USDC
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Beneficio realizado (ventas)</CardDescription>
              <CardTitle className="text-xl">
                <SignedValue value={paper.realizedPnlUsdc} />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>
                Pérdidas (vs capital inicial, a coste)
              </CardDescription>
              <CardTitle
                className={cn(
                  "font-mono text-xl tabular-nums",
                  paper.lossVsInitialUsdc > 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground"
                )}
              >
                {fmtUsdc(paper.lossVsInitialUsdc)} USDC
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>ROI vs capital inicial</CardDescription>
              <CardTitle
                className={cn(
                  "font-mono text-xl tabular-nums",
                  paper.roiVsInitialPct != null &&
                    paper.roiVsInitialPct > 0 &&
                    "text-emerald-600 dark:text-emerald-400",
                  paper.roiVsInitialPct != null &&
                    paper.roiVsInitialPct < 0 &&
                    "text-red-600 dark:text-red-400"
                )}
              >
                {fmtPct(paper.roiVsInitialPct)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Capital inicial paper:{" "}
          <span className="font-mono">{fmtUsdc(paper.initialBalanceUsdc)} USDC</span>
          {" · "}
          Operaciones:{" "}
          <span className="font-mono">{paper.tradeCount}</span>
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Mercados locales (LMSR)
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card size="sm">
            <CardHeader>
              <CardDescription>Saldo actual</CardDescription>
              <CardTitle className="font-mono text-xl tabular-nums">
                {fmtUsdc(lmsr.balanceUsdc)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Volumen (importes operados)</CardDescription>
              <CardTitle className="font-mono text-xl tabular-nums">
                {fmtUsdc(lmsr.volumeUsdc)} USDC
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Operaciones</CardDescription>
              <CardTitle className="font-mono text-xl tabular-nums">
                {lmsr.tradeCount}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
