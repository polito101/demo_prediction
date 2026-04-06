import { NextResponse } from "next/server";
import type { PolymarketGammaMarket } from "@/lib/polymarket";

const GAMMA_API = "https://gamma-api.polymarket.com";

/**
 * Proxy servidor → Gamma API para que el cliente no dependa de CORS en el navegador.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  const res = await fetch(
    `${GAMMA_API}/markets?id=${encodeURIComponent(id)}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "Error al consultar Gamma API" },
      { status: 502 }
    );
  }

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.json({ error: "Mercado no encontrado" }, { status: 404 });
  }

  return NextResponse.json(data[0] as PolymarketGammaMarket);
}
