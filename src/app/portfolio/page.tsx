import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { fetchPolymarketMarketById } from "@/lib/polymarket";
import {
  PaperPortfolioPositions,
  type PaperPositionRow,
} from "@/components/paper-portfolio-positions";
import { PortfolioStats } from "@/components/portfolio-stats";
import { LmsrPortfolioLive } from "@/components/lmsr-portfolio-live";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { PAPER_INITIAL_BALANCE } from "@/lib/paper-trading/types";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/portfolio");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  const trades = await prisma.trade.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { market: true, outcome: true },
  });

  const [paperPortfolio, paperPositionDb, lmsrTradeAgg, lmsrTradeCount] =
    await Promise.all([
      prisma.paperPortfolio.findUnique({
        where: { userId: session.user.id },
        select: { id: true, balanceUsdc: true, initialBalance: true },
      }),
      prisma.paperPosition.findMany({
        where: {
          portfolio: { userId: session.user.id },
          shares: { gt: 0 },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.trade.aggregate({
        where: { userId: session.user.id },
        _sum: { amount: true },
      }),
      prisma.trade.count({ where: { userId: session.user.id } }),
    ]);

  const [paperTradeAgg, paperTradeCount] = paperPortfolio
    ? await Promise.all([
        prisma.paperTrade.aggregate({
          where: { portfolioId: paperPortfolio.id },
          _sum: { usdcAmount: true, realizedPnl: true },
        }),
        prisma.paperTrade.count({ where: { portfolioId: paperPortfolio.id } }),
      ])
    : [
        { _sum: { usdcAmount: null, realizedPnl: null } } as const,
        0,
      ];

  if (!user) redirect("/login");

  const paperBalanceUsdc = paperPortfolio
    ? Number(paperPortfolio.balanceUsdc)
    : PAPER_INITIAL_BALANCE;

  const paperInitialBalanceUsdc = paperPortfolio
    ? Number(paperPortfolio.initialBalance)
    : PAPER_INITIAL_BALANCE;

  const paperVolumeUsdc = Number(paperTradeAgg._sum.usdcAmount ?? 0);
  const paperRealizedPnlUsdc = Number(paperTradeAgg._sum.realizedPnl ?? 0);

  const paperOpenCostBasisUsdc = paperPositionDb.reduce(
    (acc, p) => acc + Number(p.shares) * Number(p.avgBuyPrice),
    0
  );
  const paperEquityAtCostUsdc = paperBalanceUsdc + paperOpenCostBasisUsdc;
  /** Respecto al capital inicial: cuánto estás por debajo a coste (0 si vas en ganancias o igual). */
  const paperLossVsInitialUsdc = Math.max(
    0,
    paperInitialBalanceUsdc - paperEquityAtCostUsdc
  );
  const paperRoiVsInitialPct =
    paperInitialBalanceUsdc > 0
      ? ((paperEquityAtCostUsdc - paperInitialBalanceUsdc) /
          paperInitialBalanceUsdc) *
        100
      : null;

  const lmsrVolumeUsdc = Number(lmsrTradeAgg._sum.amount ?? 0);
  const lmsrBalanceUsdc = Number(user.balance);

  const uniqueMarketIds = [...new Set(paperPositionDb.map((p) => p.marketId))];
  const titleEntries = await Promise.all(
    uniqueMarketIds.map(async (id) => {
      const m = await fetchPolymarketMarketById(id);
      const title =
        m?.question?.trim() ||
        `Mercado ${id.length > 10 ? `${id.slice(0, 8)}…` : id}`;
      return [id, title] as const;
    })
  );
  const titleByMarket = new Map<string, string>(titleEntries);

  const paperPositions: PaperPositionRow[] = paperPositionDb.map((p) => ({
    marketId: p.marketId,
    marketTitle: titleByMarket.get(p.marketId) ?? p.marketId,
    outcomeIndex: p.outcomeIndex,
    outcomeName: p.outcomeName,
    shares: Number(p.shares),
    avgBuyPrice: Number(p.avgBuyPrice),
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-muted-foreground">
            Saldo mercados locales (LMSR):{" "}
            <span className="font-mono font-semibold text-foreground">
              {Number(user.balance).toLocaleString("es-ES", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}
            </span>
          </p>
        </div>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Ver mercados
        </Link>
      </div>

      <PortfolioStats
        paper={{
          initialBalanceUsdc: paperInitialBalanceUsdc,
          balanceUsdc: paperBalanceUsdc,
          volumeUsdc: paperVolumeUsdc,
          realizedPnlUsdc: paperRealizedPnlUsdc,
          tradeCount: paperTradeCount,
          lossVsInitialUsdc: paperLossVsInitialUsdc,
          roiVsInitialPct: paperRoiVsInitialPct,
        }}
        lmsr={{
          balanceUsdc: lmsrBalanceUsdc,
          volumeUsdc: lmsrVolumeUsdc,
          tradeCount: lmsrTradeCount,
        }}
      />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Polymarket — paper trading</h2>
        <p className="text-sm text-muted-foreground">
          Saldo ficticio USDC:{" "}
          <span className="font-mono font-semibold text-foreground">
            {paperBalanceUsdc.toLocaleString("es-ES", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </p>
        <PaperPortfolioPositions positions={paperPositions} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Mercados locales (LMSR) — abiertas</h2>
        <p className="text-xs text-muted-foreground">
          Precio actual y PnL no realizado se actualizan cada 15 s desde la base
          de datos. La venta de shares en LMSR se gestiona desde la ficha del
          mercado cuando esté disponible.
        </p>
        <LmsrPortfolioLive />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Historial de operaciones (locales)</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Mercado</TableHead>
                <TableHead>Lado</TableHead>
                <TableHead>Importe</TableHead>
                <TableHead>Precio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {t.createdAt.toLocaleString("es-ES")}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {t.market.title}
                  </TableCell>
                  <TableCell>{t.outcome.name}</TableCell>
                  <TableCell className="font-mono">
                    {Number(t.amount).toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {Number(t.price).toFixed(4)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {trades.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin operaciones aún.</p>
        )}
      </section>
    </div>
  );
}
