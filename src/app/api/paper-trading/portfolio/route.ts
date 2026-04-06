import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadPaperPortfolioForUser } from "@/lib/paper-trading/server";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { state } = await loadPaperPortfolioForUser(session.user.id);
  return NextResponse.json(state);
}
