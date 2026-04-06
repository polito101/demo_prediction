/**
 * Precio BTC/USD vía API pública Binance (proxy visual; Polymarket resuelve con Chainlink).
 */

export type BtcUsdPoint = { tMs: number; price: number };

/** Rango horario de la ventana en zona America/New_York (ET). */
export function formatBtcUpdownWindowLabelEt(
  slotStartSec: number,
  slotEndSec: number
): string {
  const tz = "America/New_York";
  const datePart = new Date(slotStartSec * 1000).toLocaleDateString("es-ES", {
    timeZone: tz,
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const tStart = new Date(slotStartSec * 1000).toLocaleTimeString("es-ES", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const tEnd = new Date(slotEndSec * 1000).toLocaleTimeString("es-ES", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart}, ${tStart}–${tEnd} ET`;
}

/** Precio de apertura de la vela 1m que empieza en `slotStartSec` (aprox. strike / target de la ventana). */
export async function fetchBtcUsdMinuteOpenAt(
  slotStartSec: number
): Promise<number | null> {
  const startMs = slotStartSec * 1000;
  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&startTime=${startMs}&limit=1`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
  const row = data[0] as unknown[];
  const open = Number(row[1]);
  return Number.isFinite(open) ? open : null;
}

/**
 * Serie de precios dentro de la ventana [slotStart, min(now, slotEnd)].
 * Primer punto: apertura de la primera vela (= target). Luego cierres por minuto.
 */
export async function fetchBtcUsdSeriesForWindow(
  slotStartSec: number,
  slotEndSec: number
): Promise<BtcUsdPoint[]> {
  const startMs = slotStartSec * 1000;
  const endMs = slotEndSec * 1000;
  const nowMs = Date.now();
  const effectiveEnd = Math.min(nowMs, endMs);
  if (effectiveEnd <= startMs) return [];

  const spanMin = Math.max(1, Math.ceil((effectiveEnd - startMs) / 60_000));
  const limit = Math.min(Math.max(spanMin + 1, 2), 10);

  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&startTime=${startMs}&limit=${limit}`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];

  const raw: BtcUsdPoint[] = [];
  for (const row of data) {
    if (!Array.isArray(row)) continue;
    const openT = Number(row[0]);
    const open = Number(row[1]);
    const close = Number(row[4]);
    if (!Number.isFinite(openT) || !Number.isFinite(open) || !Number.isFinite(close))
      continue;
    if (raw.length === 0) {
      raw.push({ tMs: openT, price: open });
    }
    raw.push({ tMs: openT + 60_000, price: close });
    if (openT + 60_000 >= effectiveEnd) break;
  }

  const merged = mergeBtcUsdPoints(raw);
  /** Puntos intermedios cada ~8s (menos vértices = menos artefactos al dibujar). */
  return densifyLinearSegments(merged, 8_000);
}

/** Interpola linealmente entre puntos consecutivos si el hueco temporal supera `stepMs`. */
function densifyLinearSegments(
  points: BtcUsdPoint[],
  stepMs: number
): BtcUsdPoint[] {
  if (points.length < 2) return points;
  const out: BtcUsdPoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    out.push(a);
    const gap = b.tMs - a.tMs;
    if (gap > stepMs) {
      const n = Math.min(14, Math.floor(gap / stepMs));
      for (let k = 1; k < n; k++) {
        const t = k / n;
        const tMs = Math.round(a.tMs + gap * t);
        const price = a.price + (b.price - a.price) * t;
        out.push({ tMs, price });
      }
    }
  }
  out.push(points[points.length - 1]!);
  return mergeBtcUsdPoints(out);
}

export async function fetchBtcUsdSpot(): Promise<number | null> {
  const res = await fetch(
    "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { price?: string };
  const p = Number.parseFloat(json.price ?? "");
  return Number.isFinite(p) ? p : null;
}

export function mergeBtcUsdPoints(points: BtcUsdPoint[]): BtcUsdPoint[] {
  const byT = new Map<number, number>();
  for (const { tMs, price } of points) {
    byT.set(tMs, price);
  }
  return [...byT.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tMs, price]) => ({ tMs, price }));
}
