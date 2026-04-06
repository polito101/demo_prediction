/**
 * Polymarket Data API — leaderboard público (sin API key).
 * @see https://docs.polymarket.com/api-reference/core/get-trader-leaderboard-rankings
 */

const DATA_API = "https://data-api.polymarket.com";

export type PolymarketLeaderboardEntry = {
  rank: string;
  proxyWallet: string;
  userName: string;
  vol: number;
  pnl: number;
  profileImage?: string;
  xUsername?: string;
  verifiedBadge?: boolean;
};

export async function fetchPolymarketLeaderboardTop(
  limit = 10
): Promise<PolymarketLeaderboardEntry[]> {
  const capped = Math.min(Math.max(1, limit), 50);
  const params = new URLSearchParams({
    limit: String(capped),
    offset: "0",
    orderBy: "PNL",
    timePeriod: "ALL",
    category: "OVERALL",
  });
  const res = await fetch(`${DATA_API}/v1/leaderboard?${params}`, {
    cache: "no-store",
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    console.warn("Polymarket leaderboard:", res.status, res.statusText);
    return [];
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data as PolymarketLeaderboardEntry[];
}
