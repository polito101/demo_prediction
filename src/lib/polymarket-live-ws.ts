"use client";

type FnCleanup = () => void;

type MarketSocketOptions = {
  assetIds: string[];
  onPrice: (update: { assetId: string; price: number; tMs: number }) => void;
};

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function midFromBidAsk(bestBid: unknown, bestAsk: unknown): number | null {
  const bid = asNum(bestBid);
  const ask = asNum(bestAsk);
  if (bid != null && ask != null && bid > 0 && ask > 0) return (bid + ask) / 2;
  if (bid != null && bid > 0) return bid;
  if (ask != null && ask > 0) return ask;
  return null;
}

function scheduleReconnect(connect: () => void, ms: number): number {
  return window.setTimeout(connect, ms);
}

export function openPolymarketMarketSocket({
  assetIds,
  onPrice,
}: MarketSocketOptions): FnCleanup {
  if (assetIds.length === 0) return () => {};

  let closed = false;
  let ws: WebSocket | null = null;
  let pingTimer: number | null = null;
  let reconnectTimer: number | null = null;
  let reconnectMs = 1_000;

  const connect = () => {
    if (closed) return;
    ws = new WebSocket("wss://ws-subscriptions-clob.polymarket.com/ws/market");

    ws.onopen = () => {
      reconnectMs = 1_000;
      ws?.send(
        JSON.stringify({
          assets_ids: assetIds,
          type: "market",
          custom_feature_enabled: true,
        })
      );
      pingTimer = window.setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) ws.send("PING");
      }, 10_000);
    };

    ws.onmessage = (event) => {
      const raw = event.data;
      if (typeof raw !== "string") return;
      if (raw === "PONG") return;

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return;
      }

      const eventType = String(msg.event_type ?? "");
      const ts = asNum(msg.timestamp) ?? Date.now();

      if (eventType === "best_bid_ask") {
        const assetId = String(msg.asset_id ?? "");
        const price = midFromBidAsk(msg.best_bid, msg.best_ask);
        if (assetId && price != null) onPrice({ assetId, price, tMs: ts });
        return;
      }

      if (eventType === "price_change") {
        const changes = Array.isArray(msg.price_changes) ? msg.price_changes : [];
        for (const ch of changes) {
          if (!ch || typeof ch !== "object") continue;
          const row = ch as Record<string, unknown>;
          const assetId = String(row.asset_id ?? "");
          const price = midFromBidAsk(row.best_bid, row.best_ask) ?? asNum(row.price);
          if (assetId && price != null && price > 0) {
            onPrice({ assetId, price, tMs: ts });
          }
        }
        return;
      }

      if (eventType === "book") {
        const assetId = String(msg.asset_id ?? "");
        const bids = Array.isArray(msg.bids) ? msg.bids : [];
        const asks = Array.isArray(msg.asks) ? msg.asks : [];
        const bestBid = bids
          .map((x) => (x && typeof x === "object" ? asNum((x as Record<string, unknown>).price) : null))
          .filter((x): x is number => x != null)
          .reduce<number | null>((acc, x) => (acc == null ? x : Math.max(acc, x)), null);
        const bestAsk = asks
          .map((x) => (x && typeof x === "object" ? asNum((x as Record<string, unknown>).price) : null))
          .filter((x): x is number => x != null)
          .reduce<number | null>((acc, x) => (acc == null ? x : Math.min(acc, x)), null);
        const price = midFromBidAsk(bestBid, bestAsk);
        if (assetId && price != null) onPrice({ assetId, price, tMs: ts });
        return;
      }

      if (eventType === "last_trade_price") {
        const assetId = String(msg.asset_id ?? "");
        const price = asNum(msg.price);
        if (assetId && price != null && price > 0) onPrice({ assetId, price, tMs: ts });
      }
    };

    ws.onerror = () => {
      ws?.close();
    };

    ws.onclose = () => {
      if (pingTimer != null) {
        window.clearInterval(pingTimer);
        pingTimer = null;
      }
      if (closed) return;
      reconnectTimer = scheduleReconnect(connect, reconnectMs);
      reconnectMs = Math.min(10_000, Math.round(reconnectMs * 1.7));
    };
  };

  connect();

  return () => {
    closed = true;
    if (pingTimer != null) window.clearInterval(pingTimer);
    if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
    ws?.close();
  };
}

export function openPolymarketBtcSocket(
  onPrice: (price: number, tMs: number) => void
): FnCleanup {
  let closed = false;
  let ws: WebSocket | null = null;
  let pingTimer: number | null = null;
  let reconnectTimer: number | null = null;
  let reconnectMs = 1_000;

  const connect = () => {
    if (closed) return;
    ws = new WebSocket("wss://ws-live-data.polymarket.com");

    ws.onopen = () => {
      reconnectMs = 1_000;
      ws?.send(
        JSON.stringify({
          action: "subscribe",
          subscriptions: [
            {
              topic: "crypto_prices",
              type: "update",
              filters: "btcusdt",
            },
          ],
        })
      );
      pingTimer = window.setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) ws.send("PING");
      }, 5_000);
    };

    ws.onmessage = (event) => {
      const raw = event.data;
      if (typeof raw !== "string") return;
      if (raw === "PONG") return;
      if (raw.toLowerCase() === "ping") {
        if (ws?.readyState === WebSocket.OPEN) ws.send("pong");
        return;
      }

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return;
      }
      if (String(msg.topic ?? "") !== "crypto_prices") return;
      const payload =
        msg.payload && typeof msg.payload === "object"
          ? (msg.payload as Record<string, unknown>)
          : null;
      if (!payload) return;
      if (String(payload.symbol ?? "").toLowerCase() !== "btcusdt") return;
      const price = asNum(payload.value);
      if (price == null || price <= 0) return;
      const tMs = asNum(payload.timestamp) ?? asNum(msg.timestamp) ?? Date.now();
      onPrice(price, tMs);
    };

    ws.onerror = () => {
      ws?.close();
    };

    ws.onclose = () => {
      if (pingTimer != null) {
        window.clearInterval(pingTimer);
        pingTimer = null;
      }
      if (closed) return;
      reconnectTimer = scheduleReconnect(connect, reconnectMs);
      reconnectMs = Math.min(10_000, Math.round(reconnectMs * 1.7));
    };
  };

  connect();

  return () => {
    closed = true;
    if (pingTimer != null) window.clearInterval(pingTimer);
    if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
    ws?.close();
  };
}
