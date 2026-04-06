import type { ChartRow } from "@/components/market-price-chart";
import type { PriceHistoryPoint } from "@/lib/polymarket";

/**
 * Une series de precios CLOB (timestamps distintos) en filas para Recharts.
 * Usa `tMs` (unix ms) como eje X para evitar claves duplicadas al formatear solo minuto.
 */
export function mergePolymarketHistories(
  series: { points: PriceHistoryPoint[] }[],
  maxPoints = 450
): ChartRow[] {
  if (series.length === 0) return [];

  const allT = new Set<number>();
  for (const s of series) {
    for (const p of s.points) allT.add(p.t);
  }
  let sorted = [...allT].sort((a, b) => a - b);
  if (sorted.length > maxPoints) {
    const step = Math.ceil(sorted.length / maxPoints);
    sorted = sorted.filter((_, i) => i % step === 0);
  }

  const keys = series.map((_, i) => `o${i}`);
  const last: number[] = series.map(() => NaN);
  const rows: ChartRow[] = [];

  for (const t of sorted) {
    const row: ChartRow = { tMs: t * 1000 };

    for (let i = 0; i < series.length; i++) {
      const exact = series[i].points.find((p) => p.t === t);
      if (exact) {
        last[i] = exact.p;
      } else {
        const before = series[i].points
          .filter((p) => p.t <= t)
          .sort((a, b) => b.t - a.t)[0];
        if (before) last[i] = before.p;
      }
      row[keys[i]] = Number.isFinite(last[i]) ? last[i] : 0;
    }
    rows.push(row);
  }

  return rows;
}

/** Un punto «ahora» con precios Gamma cuando el CLOB aún no devuelve historial. */
export function chartRowsFromCurrentPrices(prices: number[]): ChartRow[] {
  const now = Date.now();
  const row: ChartRow = { tMs: now };
  for (let i = 0; i < prices.length; i++) {
    row[`o${i}`] = prices[i] ?? 0;
  }
  return [row];
}
