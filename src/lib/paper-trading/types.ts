export type PaperTradeType = "buy" | "sell";

export type PaperMarketSnapshot = {
  marketId: string;
  question: string;
  outcomeNames: string[];
  outcomePrices: number[];
  fetchedAt: number;
};

export type PaperPosition = {
  id: string;
  marketId: string;
  outcomeIndex: number;
  outcomeName: string;
  shares: number;
  avgBuyPrice: number;
  openedAt: number;
  updatedAt: number;
};

export type PaperTrade = {
  id: string;
  type: PaperTradeType;
  marketId: string;
  outcomeIndex: number;
  outcomeName: string;
  shares: number;
  price: number;
  usdcAmount: number;
  realizedPnl?: number;
  timestamp: number;
};

export type PaperPortfolioState = {
  version: 1;
  balanceUsdc: number;
  positions: PaperPosition[];
  history: PaperTrade[];
};

export type BuyWithUsdcInput = {
  marketId: string;
  outcomeIndex: number;
  outcomeName: string;
  usdcAmount: number;
  executionPrice: number;
  timestamp?: number;
};

export type SellSharesInput = {
  marketId: string;
  outcomeIndex: number;
  sharesToSell: number;
  executionPrice: number;
  timestamp?: number;
};

export type PaperTradingErrorCode =
  | "INVALID_INPUT"
  | "INSUFFICIENT_FUNDS"
  | "INSUFFICIENT_SHARES"
  | "POSITION_NOT_FOUND";

export type PaperTradingResult =
  | { ok: true; nextState: PaperPortfolioState }
  | { ok: false; code: PaperTradingErrorCode; message: string };

export const PAPER_INITIAL_BALANCE = 10_000;

export function createInitialPaperPortfolioState(): PaperPortfolioState {
  return {
    version: 1,
    balanceUsdc: PAPER_INITIAL_BALANCE,
    positions: [],
    history: [],
  };
}
