import {
  parseClobTokenIds,
  parsePolymarketOutcomes,
  type PolymarketGammaMarket,
} from "@/lib/polymarket";

/**
 * Mismo origen que la app (evita CORS del navegador hacia Gamma).
 */
export async function fetchPolymarketMarketByIdClient(
  id: string
): Promise<PolymarketGammaMarket | null> {
  const res = await fetch(
    `/api/polymarket/markets/${encodeURIComponent(id)}`,
    { cache: "no-store" }
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.json() as Promise<PolymarketGammaMarket>;
}

/** Precios alineados con outcomes que tienen token CLOB (misma regla que la página / gráfico). */
export async function fetchPolymarketOutcomePrices(
  marketId: string
): Promise<number[]> {
  const market = await fetchPolymarketMarketByIdClient(marketId);
  if (!market) return [];
  const tokens = parseClobTokenIds(market.clobTokenIds);
  const outcomesAll = parsePolymarketOutcomes(market);
  const n = Math.min(outcomesAll.length, tokens.length);
  return outcomesAll.slice(0, n).map((o) => o.price);
}
