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
  /**
   * Inicio de la ventana del mercado (p. ej. BTC Up/Down 5m). Lo envía Gamma;
   * no confundir con el precio USD del strike, que no viene en la API pública.
   */
  eventStartTime?: string;
  events?: {
    slug: string;
    title?: string;
    /** Inicio de evento (equivalente a `eventStartTime` en mercados de un solo evento). */
    startTime?: string;
  }[];
  clobTokenIds?: string;
  conditionId?: string;
  bestBid?: number;
  bestAsk?: number;
  spread?: number;
  lastTradePrice?: number;
  competitive?: number;
  /** Gamma: mercado operativo */
  active?: boolean;
  /** Gamma: mercado cerrado */
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
    cache: "no-store",
  });

  if (!res.ok) {
    console.warn("Polymarket Gamma API:", res.status, res.statusText);
    return [];
  }

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];

  return (data as PolymarketGammaMarket[])
    .slice(0, limit)
    .map(normalizeGammaMarket);
}

/** Un mercado por id numérico (Gamma). */
export async function fetchPolymarketMarketById(
  id: string
): Promise<PolymarketGammaMarket | null> {
  const res = await fetch(`${GAMMA_API}/markets?id=${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || data.length === 0) return null;
  return normalizeGammaMarket(data[0] as PolymarketGammaMarket);
}

/** Unix (segundos) del inicio de ventana si el slug es `btc-updown-5m-{unix}`. */
export function parseBtcUpdownSlotStartFromSlug(slug: string | undefined): number | null {
  if (!slug) return null;
  const m = /^btc-updown-5m-(\d+)$/.exec(slug);
  return m ? Number(m[1]) : null;
}

/**
 * Inicio de ventana **según Polymarket (Gamma)**: `eventStartTime` o `events[0].startTime`.
 * Si faltan, se usa el timestamp del slug `btc-updown-5m-{unix}`.
 */
export function extractBtcUpdownWindowStartSec(
  m: PolymarketGammaMarket
): number | null {
  const iso =
    m.eventStartTime?.trim() ||
    m.events?.[0]?.startTime?.trim() ||
    undefined;
  if (iso) {
    const t = Date.parse(iso);
    if (!Number.isNaN(t)) return Math.floor(t / 1000);
  }
  return parseBtcUpdownSlotStartFromSlug(m.slug);
}

/**
 * Fin de ventana: `endDate` del mercado (Gamma). Si falta, inicio + 5 min.
 */
export function extractBtcUpdownWindowEndSec(m: PolymarketGammaMarket): number | null {
  if (m.endDate) {
    const t = Date.parse(m.endDate);
    if (!Number.isNaN(t)) return Math.floor(t / 1000);
  }
  const start = extractBtcUpdownWindowStartSec(m);
  return start != null ? start + 5 * 60 : null;
}

/**
 * La API pública de Gamma **no expone** el precio USD del strike para BTC Up/Down.
 * Si en el futuro aparece un campo numérico, se lee aquí; si no, hay que estimarlo
 * (p. ej. Chainlink/Binance en el instante `eventStartTime`).
 */
export function tryGammaBtcStrikeUsdFromMarket(
  m: PolymarketGammaMarket
): number | null {
  const raw = m as PolymarketGammaMarket & Record<string, unknown>;
  const keys = [
    "strikePrice",
    "openPrice",
    "targetPrice",
    "priceToBeat",
    "btcOpenPrice",
    "line",
  ] as const;
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "number" && Number.isFinite(v) && v > 100) return v;
    if (typeof v === "string") {
      const n = Number.parseFloat(v.replace(/[$,]/g, ""));
      if (Number.isFinite(n) && n > 100) return n;
    }
  }
  return null;
}

/** Slug Gamma del mercado recurrente «Bitcoin Up or Down — 5 minutes». */
export function btcUpdown5mSlug(unixSec: number = Math.floor(Date.now() / 1000)): string {
  const windowSec = 5 * 60;
  const slotStart = Math.floor(unixSec / windowSec) * windowSec;
  return `btc-updown-5m-${slotStart}`;
}

function normalizeGammaMarket(m: PolymarketGammaMarket): PolymarketGammaMarket {
  return {
    ...m,
    id: String(m.id),
  };
}

/** Un mercado por slug (p. ej. `btc-updown-5m-1775481000`). */
export async function fetchPolymarketMarketBySlug(
  slug: string
): Promise<PolymarketGammaMarket | null> {
  const res = await fetch(
    `${GAMMA_API}/markets/slug/${encodeURIComponent(slug)}`,
    { cache: "no-store" }
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = (await res.json()) as PolymarketGammaMarket;
  return normalizeGammaMarket(data);
}

/** El mercado BTC 5m está en curso: `now` ∈ [inicio slug, inicio+300s) y antes de `endDate`. */
function isBtcUpdown5mActive(
  m: PolymarketGammaMarket,
  nowSec: number
): boolean {
  if (m.endDate) {
    const end = Math.floor(new Date(m.endDate).getTime() / 1000);
    if (nowSec >= end) return false;
  }
  const match = /^btc-updown-5m-(\d+)$/.exec(m.slug);
  if (!match) return true;
  const start = Number(match[1]);
  return nowSec >= start && nowSec < start + 5 * 60;
}

/**
 * Mercado BTC 5m de la ventana **en curso ahora** (slug `btc-updown-5m-{unix}` alineado a 5 min UTC).
 */
export async function fetchPinnedBtcUpdown5mMarket(): Promise<PolymarketGammaMarket | null> {
  const now = Math.floor(Date.now() / 1000);
  const w = 5 * 60;
  const slot = Math.floor(now / w) * w;
  const candidates = [
    slot,
    slot - w,
    slot + w,
    slot - 2 * w,
    slot + 2 * w,
  ];
  const active: PolymarketGammaMarket[] = [];
  for (const start of candidates) {
    const m = await fetchPolymarketMarketBySlug(`btc-updown-5m-${start}`);
    if (m?.active && !m.closed) {
      if (isBtcUpdown5mActive(m, now)) return m;
      active.push(m);
    }
  }
  return active[0] ?? null;
}

/** Siguientes `count` ventanas BTC 5m (slugs `btc-updown-5m-{slot+300n}`) con etiqueta horaria ET. */
export async function fetchBtcUpdownNextMarkets(
  slotStartSec: number,
  count = 3
): Promise<{ id: string; label: string }[]> {
  const w = 5 * 60;
  const slots = Array.from({ length: count }, (_, i) => slotStartSec + (i + 1) * w);
  const markets = await Promise.all(
    slots.map((slot) => fetchPolymarketMarketBySlug(`btc-updown-5m-${slot}`))
  );
  const out: { id: string; label: string }[] = [];
  for (let i = 0; i < slots.length; i++) {
    const m = markets[i];
    if (m?.id) {
      const label = new Date(slots[i]! * 1000).toLocaleTimeString("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      out.push({ id: m.id, label });
    }
  }
  return out;
}

/** Historial de precio para un token CLOB (un outcome). */
export async function fetchPriceHistory(
  tokenId: string,
  interval: "max" | "1w" | "1d" | "6h" | "1h" | "1m" = "max"
): Promise<PriceHistoryPoint[]> {
  const params = new URLSearchParams({
    market: tokenId,
    interval,
  });
  const res = await fetch(`${CLOB_API}/prices-history?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { history?: { t: number; p: number }[] };
  return Array.isArray(json.history) ? json.history : [];
}
