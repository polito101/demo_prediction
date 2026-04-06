import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadPaperPortfolioForUser } from "@/lib/paper-trading/server";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const { state } = await loadPaperPortfolioForUser(session.user.id);
    return NextResponse.json(state);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[paper-trading/portfolio GET]", err);
    }
    return NextResponse.json(
      { error: "No se pudo cargar el portfolio" },
      { status: 500 }
    );
  }
}
