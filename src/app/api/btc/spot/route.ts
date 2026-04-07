import { NextResponse } from "next/server";
import { fetchBtcUsdSpot } from "@/lib/btc-binance";

export const runtime = "nodejs";

export async function GET() {
  const price = await fetchBtcUsdSpot();
  if (price == null) {
    return NextResponse.json({ error: "No se pudo obtener BTC/USD" }, { status: 502 });
  }
  return NextResponse.json({ price, tMs: Date.now() });
}

