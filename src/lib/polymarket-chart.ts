import type { ChartRow } from "@/components/market-price-chart";
import type { PriceHistoryPoint } from "@/lib/polymarket";

/**
 * Une series de precios CLOB (timestamps distintos) en filas para Recharts.
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
    const row: ChartRow = { t: "" };
    row.t = new Date(t * 1000).toLocaleString("es-ES", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

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
