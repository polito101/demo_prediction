/**
 * Gamma API (mercados) + CLOB API (historial de precios).
 * @see https://docs.polymarket.com/developers/gamma-markets-api/overview
 */

const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";

export type PolymarketGammaMarket = {
  id: string;
  question: string;
  description?: string;
  slug: string;
  outcomes: string;
  outcomePrices: string;
  image?: string;
  icon?: string;
  volumeNum?: number;
  volume24hr?: number;
  volume1wk?: number;
  liquidityNum?: number;
  endDate?: string;
  events?: { slug: string; title?: string }[];
  clobTokenIds?: string;
  conditionId?: string;
  bestBid?: number;
  bestAsk?: number;
  spread?: number;
  lastTradePrice?: number;
  competitive?: number;
  active?: boolean;
  closed?: boolean;
};

export type PriceHistoryPoint = { t: number; p: number };

function parseJsonArray(s: string | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function parsePrices(s: string | undefined): number[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s) as unknown;
    if (!Array.isArray(v)) return [];
    return v.map((x) => Number.parseFloat(String(x)));
  } catch {
    return [];
  }
}

export function parseClobTokenIds(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/** URL pública del evento en Polymarket. */
export function polymarketEventUrl(m: PolymarketGammaMarket): string {
  const slug = m.events?.[0]?.slug ?? m.slug;
  return `https://polymarket.com/event/${slug}`;
}

export function parsePolymarketOutcomes(m: PolymarketGammaMarket): {
  name: string;
  price: number;
}[] {
  const names = parseJsonArray(m.outcomes);
  const prices = parsePrices(m.outcomePrices);
  return names.map((name, i) => ({
    name,
    price: Number.isFinite(prices[i]) ? prices[i] : 0,
  }));
}

/**
 * Mercados activos con mayor volumen en las últimas 24h (Gamma API).
 */
export async function fetchPolymarketMarkets(
  limit = 12
): Promise<PolymarketGammaMarket[]> {
  const params = new URLSearchParams({
    active: "true",
    closed: "false",
    limit: String(Math.min(limit, 50)),
    order: "volume24hr",
    ascending: "false",
  });

  const res = await fetch(`${GAMMA_API}/markets?${params}`, {
    next: { revalidate: 120 },
  });

  if (!res.ok) {
    console.warn("Polymarket Gamma API:", res.status, res.statusText);
    return [];
  }

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];

  return (data as PolymarketGammaMarket[]).slice(0, limit);
}

/** Un mercado por id numérico (Gamma). */
export async function fetchPolymarketMarketById(
  id: string
): Promise<PolymarketGammaMarket | null> {
  const res = await fetch(`${GAMMA_API}/markets?id=${encodeURIComponent(id)}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0] as PolymarketGammaMarket;
}

/** Historial de precio para un token CLOB (un outcome). */
export async function fetchPriceHistory(
  tokenId: string,
  interval: "max" | "1w" | "1d" | "6h" | "1h" = "max"
): Promise<PriceHistoryPoint[]> {
  const params = new URLSearchParams({
    market: tokenId,
    interval,
  });
  const res = await fetch(`${CLOB_API}/prices-history?${params}`, {
    next: { revalidate: 120 },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { history?: { t: number; p: number }[] };
  return Array.isArray(json.history) ? json.history : [];
}
