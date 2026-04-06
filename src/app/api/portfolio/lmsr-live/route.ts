import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Precios actuales de outcomes y PnL no realizado para posiciones LMSR abiertas.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const positions = await prisma.position.findMany({
    where: {
      userId: session.user.id,
      settled: false,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      market: { select: { id: true, title: true } },
      outcome: { select: { id: true, name: true, currentPrice: true } },
    },
  });

  const rows = positions.map((p) => {
    const shares = Number(p.shares);
    const avg = Number(p.priceAtPurchase);
    const cur = Number(p.outcome.currentPrice);
    const unrealized = shares * (cur - avg);
    const value = shares * cur;
    return {
      id: p.id,
      marketId: p.marketId,
      marketTitle: p.market.title,
      outcomeName: p.outcome.name,
      shares,
      avgBuyPrice: avg,
      currentPrice: cur,
      marketValueUsdc: value,
      unrealizedPnlUsdc: unrealized,
    };
  });

  return NextResponse.json({
    positions: rows,
    updatedAt: Date.now(),
  });
}
