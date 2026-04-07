import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  fetchBtcUsdMinuteOpenAt,
  fetchBtcUsdSeriesForWindow,
  formatBtcUpdownWindowLabelEt,
  type BtcUsdPoint,
} from "@/lib/btc-binance";
import {
  extractBtcUpdownWindowEndSec,
  extractBtcUpdownWindowStartSec,
  fetchBtcUpdownNextMarkets,
  fetchPinnedBtcUpdown5mMarket,
  fetchPolymarketMarketById,
  fetchPriceHistory,
  parseClobTokenIds,
  parsePolymarketOutcomes,
  polymarketEventUrl,
  tryGammaBtcStrikeUsdFromMarket,
} from "@/lib/polymarket";
import {
  chartRowsFromCurrentPrices,
  mergePolymarketHistories,
} from "@/lib/polymarket-chart";
import { BtcUpdownMarketPanel } from "@/components/btc-updown-market-panel";
import { PolymarketGammaLivePrices } from "@/components/polymarket-gamma-live-prices";
import { PolymarketLivePriceChart } from "@/components/polymarket-live-price-chart";
import { PolymarketPaperTradingPanel } from "@/components/polymarket-paper-trading-panel";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Datos Gamma/CLOB sin caché de ruta; precios al cargar y en cliente vía polling. */
export const dynamic = "force-dynamic";

const COLORS = ["#6366f1", "#22c55e", "#f97316", "#ec4899", "#06b6d4", "#eab308"];

const INTERVAL_TABS: {
  value: "1m" | "1h" | "6h" | "1d" | "1w" | "max";
  label: string;
}[] = [
  { value: "1m", label: "1 min" },
  { value: "1h", label: "1 h" },
  { value: "6h", label: "6 h" },
  { value: "1d", label: "1 d" },
  { value: "1w", label: "1 sem" },
  { value: "max", label: "Máx." },
];

function parseInterval(
  raw: string | undefined
): "1m" | "1h" | "6h" | "1d" | "1w" | "max" {
  const ok = ["1m", "1h", "6h", "1d", "1w", "max"] as const;
  if (raw && (ok as readonly string[]).includes(raw)) {
    return raw as (typeof ok)[number];
  }
  return "max";
}

function fmtUsd(n: number | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n).toLocaleString("es-ES")} USDC`;
}

function fmtPct(n: number | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}¢`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const m = await fetchPolymarketMarketById(id);
  if (!m) return { title: "Mercado Polymarket" };
  const short =
    m.question.length > 72 ? `${m.question.slice(0, 69)}…` : m.question;
  return { title: `${short} | Polymarket` };
}

export default async function PolymarketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ interval?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const market = await fetchPolymarketMarketById(id);
  if (!market) notFound();

  const isBtc5mWindow =
    market.slug?.startsWith("btc-updown-5m") ?? false;
  const interval =
    sp.interval !== undefined
      ? parseInterval(sp.interval)
      : isBtc5mWindow
        ? "1m"
        : "max";

  const tokens = parseClobTokenIds(market.clobTokenIds);
  const outcomesAll = parsePolymarketOutcomes(market);
  const n = Math.min(outcomesAll.length, tokens.length);
  const outcomes = outcomesAll.slice(0, n);
  const tokenSlice = tokens.slice(0, n);

  const histories = await Promise.all(
    tokenSlice.map((tid) => fetchPriceHistory(tid, interval))
  );

  let chartData = mergePolymarketHistories(
    histories.map((points) => ({ points }))
  );
  if (chartData.length === 0 && tokenSlice.length > 0) {
    chartData = chartRowsFromCurrentPrices(outcomes.map((o) => o.price));
  }

  const outcomeKeys = outcomes.map((o, i) => ({
    key: `o${i}`,
    name: o.name,
    color: COLORS[i % COLORS.length],
  }));

  const ext = polymarketEventUrl(market);

  const slotStart = extractBtcUpdownWindowStartSec(market);
  const slotEnd = extractBtcUpdownWindowEndSec(market);
  let btcTarget: number | null = null;
  let btcInitialPoints: BtcUsdPoint[] = [];
  let btcWindowLabelEt = "";
  let btcNextMarkets: { id: string; label: string }[] = [];
  let btcLiveMarketId: string | null = null;

  if (isBtc5mWindow && slotStart != null && slotEnd != null) {
    btcWindowLabelEt = formatBtcUpdownWindowLabelEt(slotStart, slotEnd);
    btcTarget =
      tryGammaBtcStrikeUsdFromMarket(market) ??
      (await fetchBtcUsdMinuteOpenAt(slotStart));
    btcInitialPoints = await fetchBtcUsdSeriesForWindow(slotStart, slotEnd);
    if (btcTarget != null && btcInitialPoints.length === 0) {
      btcInitialPoints = [{ tMs: slotStart * 1000, price: btcTarget }];
    }
    if (
      btcTarget != null &&
      btcInitialPoints.length > 0 &&
      Math.abs(btcInitialPoints[0]!.price - btcTarget) > 0.5
    ) {
      btcInitialPoints = [
        { tMs: btcInitialPoints[0]!.tMs, price: btcTarget },
        ...btcInitialPoints.slice(1),
      ];
    }
    btcNextMarkets = await fetchBtcUpdownNextMarkets(slotStart, 3);
    const pinnedLive = await fetchPinnedBtcUpdown5mMarket();
    btcLiveMarketId = pinnedLive?.id ?? null;
  }

  // eslint-disable-next-line react-hooks/purity
  const btcServerNowMs = Date.now();
  const btcInitialLeftSec =
    slotEnd != null
      ? Math.max(0, slotEnd - Math.floor(btcServerNowMs / 1000))
      : 0;

  const showBtcSpotChart =
    isBtc5mWindow &&
    slotStart != null &&
    slotEnd != null &&
    btcTarget != null &&
    btcInitialPoints.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>

        <div className="flex flex-wrap items-start gap-4">
          {(market.image || market.icon) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={market.image ?? market.icon}
              alt=""
              className="h-20 w-20 shrink-0 rounded-lg border object-cover"
            />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold leading-tight">
                {market.question}
              </h1>
              <Badge variant="secondary">Polymarket</Badge>
            </div>
            {isBtc5mWindow && btcWindowLabelEt ? (
              <p className="text-sm text-muted-foreground">{btcWindowLabelEt}</p>
            ) : (
              market.description && (
                <p className="text-sm text-muted-foreground">{market.description}</p>
              )
            )}
            <a
              href={ext}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Abrir en polymarket.com
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Volumen 24 h"
          value={fmtUsd(market.volume24hr)}
          hint="Mayor actividad reciente"
        />
        <MetricCard
          title="Volumen total"
          value={fmtUsd(market.volumeNum)}
          hint="Histórico acumulado (Gamma)"
        />
        <MetricCard
          title="Liquidez"
          value={fmtUsd(market.liquidityNum)}
          hint="Libro de órdenes"
        />
        <MetricCard
          title="Spread / último"
          value={
            market.spread != null
              ? `${(market.spread * 100).toFixed(2)} pts`
              : "—"
          }
          hint={
            market.lastTradePrice != null
              ? `Último: ${fmtPct(market.lastTradePrice)}`
              : undefined
          }
        />
      </div>

      {market.endDate && (
        <p className="text-sm text-muted-foreground">
          Cierre previsto:{" "}
          <time dateTime={market.endDate}>
            {new Date(market.endDate).toLocaleString("es-ES")}
          </time>
        </p>
      )}

      <section className="space-y-3">
        {showBtcSpotChart ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-zinc-100 shadow-sm">
            <div className="mb-4 space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">
                Bitcoin — precio spot (USD)
              </h2>
              <p className="text-xs text-zinc-500">
                Misma idea que en polymarket.com: línea naranja = BTC/USD en vivo;
                línea gris = precio a superar (apertura de la ventana). Precio en
                streaming vía WebSocket (RTDS).
              </p>
              <p className="text-[11px] text-zinc-600">
                Charts by TradingView Lightweight Charts™ ·{" "}
                <a
                  href="https://www.tradingview.com"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-zinc-500"
                >
                  tradingview.com
                </a>
              </p>
            </div>
            <BtcUpdownMarketPanel
              marketId={id}
              slotEndSec={slotEnd!}
              targetPrice={btcTarget!}
              initialPoints={btcInitialPoints}
              nextMarkets={btcNextMarkets}
              liveMarketId={btcLiveMarketId}
              initialLeftSec={btcInitialLeftSec}
              initialNowMs={btcServerNowMs}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Precio implícito (CLOB)</h2>
                <p className="text-xs text-muted-foreground">
                  Historial CLOB (actualización cada ~4 s en esta vista). En mercados
                  con dos resultados, la línea punteada es el 50 % de referencia.
                  {isBtc5mWindow && (
                    <>
                      {" "}
                      Por defecto <strong>1 min</strong> para esta ventana BTC 5 min.
                    </>
                  )}
                </p>
                {isBtc5mWindow && !showBtcSpotChart && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                    No se pudo cargar el precio spot de Binance; mostrando probabilidad
                    CLOB.
                  </p>
                )}
              </div>
              <nav className="flex flex-wrap gap-1">
                {INTERVAL_TABS.map((tab) => (
                  <Link
                    key={tab.value}
                    href={`/polymarket/${id}?interval=${tab.value}`}
                    scroll={false}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      interval === tab.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {tab.label}
                  </Link>
                ))}
              </nav>
            </div>

            {tokenSlice.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay tokens CLOB asociados; el histórico no está disponible para
                este mercado.
              </p>
            ) : (
              <PolymarketLivePriceChart
                key={`${id}-${interval}`}
                marketId={id}
                interval={interval}
                initialData={chartData}
                outcomeKeys={outcomeKeys}
                showMidpointLine={n === 2}
              />
            )}
          </>
        )}
      </section>

      <section className="space-y-2">
        <div>
          <h2 className="text-lg font-semibold">Precios actuales</h2>
          <p className="text-xs text-muted-foreground">
            {tokenSlice.length > 0 ? (
              <>
                Flujo en tiempo real por WebSocket del market channel de Polymarket
                (best bid/ask y trades) para estos outcomes.
              </>
            ) : (
              <>
                Este mercado no expone token IDs CLOB en la respuesta inicial, por lo que
                aquí no se puede abrir suscripción WebSocket de precios.
              </>
            )}
          </p>
        </div>
        <PolymarketGammaLivePrices
          marketId={market.id}
          clobTokenIds={tokenSlice}
          initialOutcomes={outcomes.map((o) => ({ name: o.name, price: o.price }))}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Panel de paper trading</h2>
        <p className="text-xs text-muted-foreground">
          Portfolio local con 10,000 USDC ficticios, usando precio real del
          mercado en cada ejecución.
        </p>
        <PolymarketPaperTradingPanel
          marketId={market.id}
          clobTokenIds={tokenSlice}
          outcomes={outcomes.map((o, i) => ({
            index: i,
            name: o.name,
            price: o.price,
          }))}
        />
      </section>

    </div>
  );
}

function MetricCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint && (
        <CardContent className="pt-0 text-xs text-muted-foreground">
          {hint}
        </CardContent>
      )}
    </Card>
  );
}