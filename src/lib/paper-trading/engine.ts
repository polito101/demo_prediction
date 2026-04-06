import Decimal from "decimal.js";
import type {
  BuyWithUsdcInput,
  PaperPortfolioState,
  PaperTradingResult,
  SellSharesInput,
} from "@/lib/paper-trading/types";

const SHARES_DP = 6;
const USDC_DP = 2;
const PRICE_MIN = 0;
const PRICE_MAX = 1;

function roundUsdc(v: Decimal): Decimal {
  return v.toDecimalPlaces(USDC_DP, Decimal.ROUND_HALF_UP);
}

function roundShares(v: Decimal): Decimal {
  return v.toDecimalPlaces(SHARES_DP, Decimal.ROUND_DOWN);
}

function positionId(marketId: string, outcomeIndex: number): string {
  return `${marketId}:${outcomeIndex}`;
}

function isValidExecutionPrice(price: number): boolean {
  return Number.isFinite(price) && price > PRICE_MIN && price <= PRICE_MAX;
}

function invalidInput(message: string): PaperTradingResult {
  return { ok: false, code: "INVALID_INPUT", message };
}

export function buyWithUsdc(
  state: PaperPortfolioState,
  input: BuyWithUsdcInput
): PaperTradingResult {
  if (!isValidExecutionPrice(input.executionPrice)) {
    return invalidInput("El precio de ejecución debe estar entre 0 y 1.");
  }
  if (!Number.isFinite(input.usdcAmount) || input.usdcAmount <= 0) {
    return invalidInput("El importe a comprar debe ser mayor que 0.");
  }

  const now = input.timestamp ?? Date.now();
  const executionPrice = new Decimal(input.executionPrice);
  const usdcAmount = roundUsdc(new Decimal(input.usdcAmount));
  const shares = roundShares(usdcAmount.div(executionPrice));

  if (shares.lte(0)) {
    return invalidInput("La compra genera 0 shares con el precio actual.");
  }

  const balance = new Decimal(state.balanceUsdc);
  if (usdcAmount.gt(balance)) {
    return {
      ok: false,
      code: "INSUFFICIENT_FUNDS",
      message: "Fondos insuficientes para ejecutar la compra.",
    };
  }

  const nextBalance = roundUsdc(balance.minus(usdcAmount));
  const nextPositions = [...state.positions];
  const id = positionId(input.marketId, input.outcomeIndex);
  const idx = nextPositions.findIndex((p) => p.id === id);

  if (idx >= 0) {
    const prev = nextPositions[idx];
    const prevShares = new Decimal(prev.shares);
    const newTotalShares = roundShares(prevShares.plus(shares));
    const prevCost = prevShares.mul(prev.avgBuyPrice);
    const newCost = shares.mul(executionPrice);
    const avgBuyPrice = newTotalShares.eq(0)
      ? new Decimal(0)
      : prevCost.plus(newCost).div(newTotalShares);

    nextPositions[idx] = {
      ...prev,
      outcomeName: input.outcomeName,
      shares: newTotalShares.toNumber(),
      avgBuyPrice: avgBuyPrice.toNumber(),
      updatedAt: now,
    };
  } else {
    nextPositions.push({
      id,
      marketId: input.marketId,
      outcomeIndex: input.outcomeIndex,
      outcomeName: input.outcomeName,
      shares: shares.toNumber(),
      avgBuyPrice: executionPrice.toNumber(),
      openedAt: now,
      updatedAt: now,
    });
  }

  const nextHistory = [
    {
      id: `buy:${id}:${now}`,
      type: "buy" as const,
      marketId: input.marketId,
      outcomeIndex: input.outcomeIndex,
      outcomeName: input.outcomeName,
      shares: shares.toNumber(),
      price: executionPrice.toNumber(),
      usdcAmount: usdcAmount.toNumber(),
      timestamp: now,
    },
    ...state.history,
  ];

  return {
    ok: true,
    nextState: {
      ...state,
      balanceUsdc: nextBalance.toNumber(),
      positions: nextPositions,
      history: nextHistory,
    },
  };
}

export function sellShares(
  state: PaperPortfolioState,
  input: SellSharesInput
): PaperTradingResult {
  if (!isValidExecutionPrice(input.executionPrice)) {
    return invalidInput("El precio de ejecución debe estar entre 0 y 1.");
  }
  if (!Number.isFinite(input.sharesToSell) || input.sharesToSell <= 0) {
    return invalidInput("La cantidad de shares a vender debe ser mayor que 0.");
  }

  const now = input.timestamp ?? Date.now();
  const executionPrice = new Decimal(input.executionPrice);
  const sharesToSell = roundShares(new Decimal(input.sharesToSell));
  const id = positionId(input.marketId, input.outcomeIndex);
  const idx = state.positions.findIndex((p) => p.id === id);

  if (idx < 0) {
    return {
      ok: false,
      code: "POSITION_NOT_FOUND",
      message: "No existe una posición abierta para esa opción.",
    };
  }

  const pos = state.positions[idx];
  const currentShares = new Decimal(pos.shares);
  if (sharesToSell.gt(currentShares)) {
    return {
      ok: false,
      code: "INSUFFICIENT_SHARES",
      message: "No puedes vender más shares de los que tienes.",
    };
  }

  const proceeds = roundUsdc(sharesToSell.mul(executionPrice));
  const realizedPnl = roundUsdc(
    sharesToSell.mul(executionPrice.minus(pos.avgBuyPrice))
  );
  const nextBalance = roundUsdc(new Decimal(state.balanceUsdc).plus(proceeds));

  const leftShares = roundShares(currentShares.minus(sharesToSell));
  const nextPositions = [...state.positions];
  if (leftShares.lte(0)) {
    nextPositions.splice(idx, 1);
  } else {
    nextPositions[idx] = {
      ...pos,
      shares: leftShares.toNumber(),
      updatedAt: now,
    };
  }

  const nextHistory = [
    {
      id: `sell:${id}:${now}`,
      type: "sell" as const,
      marketId: pos.marketId,
      outcomeIndex: pos.outcomeIndex,
      outcomeName: pos.outcomeName,
      shares: sharesToSell.toNumber(),
      price: executionPrice.toNumber(),
      usdcAmount: proceeds.toNumber(),
      realizedPnl: realizedPnl.toNumber(),
      timestamp: now,
    },
    ...state.history,
  ];

  return {
    ok: true,
    nextState: {
      ...state,
      balanceUsdc: nextBalance.toNumber(),
      positions: nextPositions,
      history: nextHistory,
    },
  };
}
