import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { buyWithUsdc } from "@/lib/paper-trading/engine";
import {
  loadPaperPortfolioForUser,
  savePaperPortfolioState,
} from "@/lib/paper-trading/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  marketId: z.string().min(1),
  outcomeIndex: z.number().int().min(0),
  outcomeName: z.string().min(1),
  usdcAmount: z.number().positive(),
  executionPrice: z.number().positive().max(1),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await loadPaperPortfolioForUser(session.user.id, tx);
      const op = buyWithUsdc(current.state, {
        ...parsed.data,
        timestamp: Date.now(),
      });

      if (!op.ok) {
        return op;
      }

      await savePaperPortfolioState(tx, {
        portfolioId: current.portfolioId,
        nextState: op.nextState,
        latestTrade: op.nextState.history[0],
      });
      return op;
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status: 400 }
      );
    }

    return NextResponse.json(result.nextState);
  } catch {
    return NextResponse.json(
      { error: "No se pudo ejecutar la compra" },
      { status: 500 }
    );
  }
}
