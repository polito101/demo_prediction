import test from "node:test";
import assert from "node:assert/strict";
import { buyWithUsdc, sellShares } from "@/lib/paper-trading/engine";
import { createInitialPaperPortfolioState } from "@/lib/paper-trading/types";

const MARKET_ID = "12345";
const OUTCOME_INDEX = 0;
const OUTCOME_NAME = "Yes";

test("buyWithUsdc compra shares y descuenta balance", () => {
  const state = createInitialPaperPortfolioState();
  const res = buyWithUsdc(state, {
    marketId: MARKET_ID,
    outcomeIndex: OUTCOME_INDEX,
    outcomeName: OUTCOME_NAME,
    usdcAmount: 60,
    executionPrice: 0.6,
    timestamp: 1_700_000_000_000,
  });

  assert.equal(res.ok, true);
  if (!res.ok) return;

  assert.equal(res.nextState.balanceUsdc, 9940);
  assert.equal(res.nextState.positions.length, 1);
  assert.equal(res.nextState.positions[0].shares, 100);
  assert.equal(res.nextState.positions[0].avgBuyPrice, 0.6);
  assert.equal(res.nextState.history.length, 1);
  assert.equal(res.nextState.history[0].type, "buy");
});

test("buyWithUsdc agrega a posición existente y recalcula precio medio", () => {
  const initial = createInitialPaperPortfolioState();
  const first = buyWithUsdc(initial, {
    marketId: MARKET_ID,
    outcomeIndex: OUTCOME_INDEX,
    outcomeName: OUTCOME_NAME,
    usdcAmount: 60,
    executionPrice: 0.6,
    timestamp: 1_700_000_000_000,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;

  const second = buyWithUsdc(first.nextState, {
    marketId: MARKET_ID,
    outcomeIndex: OUTCOME_INDEX,
    outcomeName: OUTCOME_NAME,
    usdcAmount: 50,
    executionPrice: 0.5,
    timestamp: 1_700_000_000_100,
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;

  const pos = second.nextState.positions[0];
  assert.equal(second.nextState.positions.length, 1);
  assert.equal(pos.shares, 200);
  assert.equal(Number(pos.avgBuyPrice.toFixed(6)), 0.55);
  assert.equal(second.nextState.balanceUsdc, 9890);
  assert.equal(second.nextState.history.length, 2);
});

test("buyWithUsdc falla por fondos insuficientes", () => {
  const state = createInitialPaperPortfolioState();
  const res = buyWithUsdc(state, {
    marketId: MARKET_ID,
    outcomeIndex: OUTCOME_INDEX,
    outcomeName: OUTCOME_NAME,
    usdcAmount: 20_000,
    executionPrice: 0.7,
    timestamp: 1_700_000_000_000,
  });

  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.code, "INSUFFICIENT_FUNDS");
});

test("buyWithUsdc valida inputs inválidos", () => {
  const state = createInitialPaperPortfolioState();

  const invalidPrice = buyWithUsdc(state, {
    marketId: MARKET_ID,
    outcomeIndex: OUTCOME_INDEX,
    outcomeName: OUTCOME_NAME,
    usdcAmount: 100,
    executionPrice: 0,
  });
  assert.equal(invalidPrice.ok, false);
  if (!invalidPrice.ok) assert.equal(invalidPrice.code, "INVALID_INPUT");

  const invalidAmount = buyWithUsdc(state, {
    marketId: MARKET_ID,
    outcomeIndex: OUTCOME_INDEX,
    outcomeName: OUTCOME_NAME,
    usdcAmount: -5,
    executionPrice: 0.4,
  });
  assert.equal(invalidAmount.ok, false);
  if (!invalidAmount.ok) assert.equal(invalidAmount.code, "INVALID_INPUT");
});

test("sellShares vende parcial, acredita balance y registra pnl realizado", () => {
  const start = createInitialPaperPortfolioState();
  const bought = buyWithUsdc(start, {
    marketId: MARKET_ID,
    outcomeIndex: OUTCOME_INDEX,
    outcomeName: OUTCOME_NAME,
    usdcAmount: 60,
    executionPrice: 0.6,
    timestamp: 1_700_000_000_000,
  });
  assert.equal(bought.ok, true);
  if (!bought.ok) return;

  const sold = sellShares(bought.nextState, {
    marketId: MARKET_ID,
    outcomeIndex: OUTCOME_INDEX,
    sharesToSell: 40,
    executionPrice: 0.7,
    timestamp: 1_700_000_000_100,
  });
  assert.equal(sold.ok, true);
  if (!sold.ok) return;

  const pos = sold.nextState.positions[0];
  assert.equal(pos.shares, 60);
  assert.equal(sold.nextState.balanceUsdc, 9968);
  assert.equal(sold.nextState.history[0].type, "sell");
  assert.equal(sold.nextState.history[0].usdcAmount, 28);
  assert.equal(sold.nextState.history[0].realizedPnl, 4);
});

test("sellShares elimina posición cuando vende todo", () => {
  const start = createInitialPaperPortfolioState();
  const bought = buyWithUsdc(start, {
    marketId: MARKET_ID,
    outcomeIndex: OUTCOME_INDEX,
    outcomeName: OUTCOME_NAME,
    usdcAmount: 100,
    executionPrice: 0.5,
    timestamp: 1_700_000_000_000,
  });
  assert.equal(bought.ok, true);
  if (!bought.ok) return;

  const soldAll = sellShares(bought.nextState, {
    marketId: MARKET_ID,
    outcomeIndex: OUTCOME_INDEX,
    sharesToSell: 200,
    executionPrice: 0.55,
    timestamp: 1_700_000_000_100,
  });
  assert.equal(soldAll.ok, true);
  if (!soldAll.ok) return;

  assert.equal(soldAll.nextState.positions.length, 0);
  assert.equal(soldAll.nextState.balanceUsdc, 10010);
});

test("sellShares falla cuando no existe posición o shares insuficientes", () => {
  const start = createInitialPaperPortfolioState();
  const noPosition = sellShares(start, {
    marketId: MARKET_ID,
    outcomeIndex: OUTCOME_INDEX,
    sharesToSell: 1,
    executionPrice: 0.5,
    timestamp: 1_700_000_000_100,
  });
  assert.equal(noPosition.ok, false);
  if (!noPosition.ok) assert.equal(noPosition.code, "POSITION_NOT_FOUND");

  const bought = buyWithUsdc(start, {
    marketId: MARKET_ID,
    outcomeIndex: OUTCOME_INDEX,
    outcomeName: OUTCOME_NAME,
    usdcAmount: 10,
    executionPrice: 0.5,
    timestamp: 1_700_000_000_000,
  });
  assert.equal(bought.ok, true);
  if (!bought.ok) return;

  const tooMany = sellShares(bought.nextState, {
    marketId: MARKET_ID,
    outcomeIndex: OUTCOME_INDEX,
    sharesToSell: 999,
    executionPrice: 0.5,
    timestamp: 1_700_000_000_100,
  });
  assert.equal(tooMany.ok, false);
  if (!tooMany.ok) assert.equal(tooMany.code, "INSUFFICIENT_SHARES");
});

test("sellShares valida precio y cantidad", () => {
  const start = createInitialPaperPortfolioState();
  const bought = buyWithUsdc(start, {
    marketId: MARKET_ID,
    outcomeIndex: OUTCOME_INDEX,
    outcomeName: OUTCOME_NAME,
    usdcAmount: 10,
    executionPrice: 0.5,
    timestamp: 1_700_000_000_000,
  });
  assert.equal(bought.ok, true);
  if (!bought.ok) return;

  const invalidPrice = sellShares(bought.nextState, {
    marketId: MARKET_ID,
    outcomeIndex: OUTCOME_INDEX,
    sharesToSell: 1,
    executionPrice: 1.2,
  });
  assert.equal(invalidPrice.ok, false);
  if (!invalidPrice.ok) assert.equal(invalidPrice.code, "INVALID_INPUT");

  const invalidShares = sellShares(bought.nextState, {
    marketId: MARKET_ID,
    outcomeIndex: OUTCOME_INDEX,
    sharesToSell: 0,
    executionPrice: 0.5,
  });
  assert.equal(invalidShares.ok, false);
  if (!invalidShares.ok) assert.equal(invalidShares.code, "INVALID_INPUT");
});
