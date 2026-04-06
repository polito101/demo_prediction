import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  loadPaperPortfolioForUser,
  savePaperPortfolioState,
} from "@/lib/paper-trading/server";
import { createInitialPaperPortfolioState } from "@/lib/paper-trading/types";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const state = await prisma.$transaction(async (tx) => {
      const current = await loadPaperPortfolioForUser(session.user.id, tx);
      const nextState = createInitialPaperPortfolioState();
      await savePaperPortfolioState(tx, {
        portfolioId: current.portfolioId,
        nextState,
      });
      return nextState;
    });

    return NextResponse.json(state);
  } catch {
    return NextResponse.json(
      { error: "No se pudo resetear el portfolio" },
      { status: 500 }
    );
  }
}
