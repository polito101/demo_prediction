import { prisma } from "@/lib/db";

export type PlatformTraderRow = {
  rank: number;
  displayName: string;
  /** Suma de PnL realizado en paper (ventas). */
  realizedPnlUsdc: number;
  /** Volumen paper (suma de notionales). */
  volumeUsdc: number;
};

function shortDisplay(email: string, name: string | null): string {
  const n = name?.trim();
  if (n) return n;
  const [local, domain] = email.split("@");
  if (!domain) return email.slice(0, 12) + (email.length > 12 ? "…" : "");
  if (local.length <= 3) return `${local}@${domain}`;
  return `${local.slice(0, 3)}…@${domain}`;
}

/**
 * Top traders del tenant por PnL realizado acumulado (paper Polymarket), con
 * desempate por volumen.
 */
export async function fetchTopPlatformTraders(
  tenantId: string,
  limit = 10
): Promise<PlatformTraderRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      email: string;
      name: string | null;
      realized: unknown;
      vol: unknown;
    }>
  >`
    SELECT u.id, u.email, u.name,
      COALESCE(SUM(pt."realizedPnl"), 0) AS realized,
      COALESCE(SUM(pt."usdcAmount"), 0) AS vol
    FROM "User" u
    INNER JOIN "PaperPortfolio" pp ON pp."userId" = u.id
    LEFT JOIN "PaperTrade" pt ON pt."portfolioId" = pp.id
    WHERE u."tenantId" = ${tenantId}
    GROUP BY u.id, u.email, u.name
    ORDER BY realized DESC, vol DESC
    LIMIT ${limit}
  `;

  return rows.map((r, i) => ({
    rank: i + 1,
    displayName: shortDisplay(r.email, r.name),
    realizedPnlUsdc: Number(r.realized),
    volumeUsdc: Number(r.vol),
  }));
}
