import { NextResponse } from "next/server";
import {
  fetchPolymarketMarketById,
  fetchPriceHistory,
  parseClobTokenIds,
  parsePolymarketOutcomes,
} from "@/lib/polymarket";
import {
  chartRowsFromCurrentPrices,
  mergePolymarketHistories,
} from "@/lib/polymarket-chart";

const INTERVALS = ["1m", "1h", "6h", "1d", "1w", "max"] as const;
type Interval = (typeof INTERVALS)[number];

function parseInterval(raw: string | null): Interval {
  if (raw && (INTERVALS as readonly string[]).includes(raw)) {
    return raw as Interval;
  }
  return "max";
}

/**
 * Historial CLOB fusionado para el gráfico (polling en cliente).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const interval = parseInterval(searchParams.get("interval"));

  const market = await fetchPolymarketMarketById(id);
  if (!market) {
    return NextResponse.json({ error: "Mercado no encontrado" }, { status: 404 });
  }

  const tokens = parseClobTokenIds(market.clobTokenIds);
  const outcomesAll = parsePolymarketOutcomes(market);
  const n = Math.min(outcomesAll.length, tokens.length);
  const tokenSlice = tokens.slice(0, n);

  if (tokenSlice.length === 0) {
    return NextResponse.json({ chartData: [] });
  }

  const histories = await Promise.all(
    tokenSlice.map((tid) => fetchPriceHistory(tid, interval))
  );

  let chartData = mergePolymarketHistories(
    histories.map((points) => ({ points }))
  );

  if (chartData.length === 0 && n > 0) {
    chartData = chartRowsFromCurrentPrices(
      outcomesAll.slice(0, n).map((o) => o.price)
    );
  }

  return NextResponse.json({ chartData });
}
