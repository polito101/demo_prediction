import {
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

export async function fetchPolymarketOutcomePrices(
  marketId: string
): Promise<number[]> {
  const market = await fetchPolymarketMarketByIdClient(marketId);
  if (!market) return [];
  return parsePolymarketOutcomes(market).map((o) => o.price);
}
