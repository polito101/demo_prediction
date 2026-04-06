import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { PaperPortfolioState } from "@/lib/paper-trading/types";

const INITIAL_BALANCE = "10000";

type TxClient = Prisma.TransactionClient;

async function ensurePortfolio(
  tx: TxClient,
  userId: string
): Promise<{ id: string }> {
  return tx.paperPortfolio.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      balanceUsdc: INITIAL_BALANCE,
      initialBalance: INITIAL_BALANCE,
    },
    select: { id: true },
  });
}

export async function loadPaperPortfolioForUser(
  userId: string,
  txClient?: TxClient
): Promise<{ portfolioId: string; state: PaperPortfolioState }> {
  const tx = txClient ?? prisma;
  const base = await ensurePortfolio(tx as TxClient, userId);

  const [portfolio, positions, trades] = await Promise.all([
    tx.paperPortfolio.findUniqueOrThrow({
      where: { id: base.id },
      select: { id: true, balanceUsdc: true },
    }),
    tx.paperPosition.findMany({
      where: { portfolioId: base.id },
      orderBy: [{ marketId: "asc" }, { outcomeIndex: "asc" }],
    }),
    tx.paperTrade.findMany({
      where: { portfolioId: base.id },
      orderBy: { timestamp: "desc" },
      take: 200,
    }),
  ]);

  return {
    portfolioId: portfolio.id,
    state: {
      version: 1,
      balanceUsdc: Number(portfolio.balanceUsdc),
      positions: positions.map((p) => ({
        id: `${p.marketId}:${p.outcomeIndex}`,
        marketId: p.marketId,
        outcomeIndex: p.outcomeIndex,
        outcomeName: p.outcomeName,
        shares: Number(p.shares),
        avgBuyPrice: Number(p.avgBuyPrice),
        openedAt: p.openedAt.getTime(),
        updatedAt: p.updatedAt.getTime(),
      })),
      history: trades.map((t) => ({
        id: t.id,
        type: t.type === "BUY" ? "buy" : "sell",
        marketId: t.marketId,
        outcomeIndex: t.outcomeIndex,
        outcomeName: t.outcomeName,
        shares: Number(t.shares),
        price: Number(t.price),
        usdcAmount: Number(t.usdcAmount),
        realizedPnl: t.realizedPnl != null ? Number(t.realizedPnl) : undefined,
        timestamp: t.timestamp.getTime(),
      })),
    },
  };
}

export async function savePaperPortfolioState(
  tx: TxClient,
  args: {
    portfolioId: string;
    nextState: PaperPortfolioState;
    latestTrade?: PaperPortfolioState["history"][number];
  }
) {
  const { portfolioId, nextState, latestTrade } = args;

  await tx.paperPortfolio.update({
    where: { id: portfolioId },
    data: { balanceUsdc: nextState.balanceUsdc.toFixed(8) },
  });

  await tx.paperPosition.deleteMany({ where: { portfolioId } });
  if (nextState.positions.length > 0) {
    await tx.paperPosition.createMany({
      data: nextState.positions.map((p) => ({
        portfolioId,
        marketId: p.marketId,
        outcomeIndex: p.outcomeIndex,
        outcomeName: p.outcomeName,
        shares: p.shares.toFixed(8),
        avgBuyPrice: p.avgBuyPrice.toFixed(8),
        openedAt: new Date(p.openedAt),
        updatedAt: new Date(p.updatedAt),
      })),
    });
  }

  if (latestTrade) {
    await tx.paperTrade.create({
      data: {
        portfolioId,
        type: latestTrade.type === "buy" ? "BUY" : "SELL",
        marketId: latestTrade.marketId,
        outcomeIndex: latestTrade.outcomeIndex,
        outcomeName: latestTrade.outcomeName,
        shares: latestTrade.shares.toFixed(8),
        price: latestTrade.price.toFixed(8),
        usdcAmount: latestTrade.usdcAmount.toFixed(8),
        realizedPnl:
          latestTrade.realizedPnl != null
            ? latestTrade.realizedPnl.toFixed(8)
            : null,
        timestamp: new Date(latestTrade.timestamp),
      },
    });
  }
}
