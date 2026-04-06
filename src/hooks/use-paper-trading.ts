"use client";

import { useCallback, useEffect, useState } from "react";
import { PAPER_PORTFOLIO_RESET_EVENT } from "@/lib/paper-portfolio-events";
import {
  createInitialPaperPortfolioState,
  type PaperPortfolioState,
  type PaperTradingErrorCode,
} from "@/lib/paper-trading/types";

type BuyPositionInput = {
  marketId: string;
  outcomeIndex: number;
  outcomeName: string;
  usdcAmount: number;
  executionPrice: number;
};

type SellPositionInput = {
  marketId: string;
  outcomeIndex: number;
  sharesToSell: number;
  executionPrice: number;
};

type HookResult =
  | { ok: true }
  | { ok: false; code: PaperTradingErrorCode; message: string };

export function usePaperTrading() {
  const [portfolio, setPortfolio] = useState<PaperPortfolioState>(
    createInitialPaperPortfolioState()
  );
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPortfolio = useCallback(async () => {
    setLoadError(null);
    const res = await fetch("/api/paper-trading/portfolio", {
      cache: "no-store",
    });
    if (res.status === 401) {
      setHydrated(true);
      setLoadError("Debes iniciar sesión para usar paper trading persistente.");
      return;
    }
    if (!res.ok) {
      setHydrated(true);
      setLoadError("No se pudo cargar el portfolio.");
      return;
    }
    const data = (await res.json()) as PaperPortfolioState;
    setPortfolio(data);
    setHydrated(true);
  }, []);

  useEffect(() => {
    // Carga inicial del portfolio persistido en DB al montar el panel.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPortfolio();
  }, [loadPortfolio]);

  useEffect(() => {
    const sync = () => void loadPortfolio();
    window.addEventListener(PAPER_PORTFOLIO_RESET_EVENT, sync);
    return () => window.removeEventListener(PAPER_PORTFOLIO_RESET_EVENT, sync);
  }, [loadPortfolio]);

  const buyPosition = useCallback(
    async (input: BuyPositionInput): Promise<HookResult> => {
      const res = await fetch("/api/paper-trading/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as
          | { error?: string; code?: PaperTradingErrorCode }
          | null;
        return {
          ok: false,
          code: err?.code ?? "INVALID_INPUT",
          message: err?.error ?? "No se pudo ejecutar la compra",
        };
      }
      const next = (await res.json()) as PaperPortfolioState;
      setPortfolio(next);
      return { ok: true };
    },
    []
  );

  const sellPosition = useCallback(
    async (input: SellPositionInput): Promise<HookResult> => {
      const res = await fetch("/api/paper-trading/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as
          | { error?: string; code?: PaperTradingErrorCode }
          | null;
        return {
          ok: false,
          code: err?.code ?? "INVALID_INPUT",
          message: err?.error ?? "No se pudo ejecutar la venta",
        };
      }
      const next = (await res.json()) as PaperPortfolioState;
      setPortfolio(next);
      return { ok: true };
    },
    []
  );

  const resetPortfolio = useCallback(async () => {
    const res = await fetch("/api/paper-trading/reset", {
      method: "POST",
    });
    if (!res.ok) {
      return { ok: false as const };
    }
    const next = (await res.json()) as PaperPortfolioState;
    setPortfolio(next);
    return { ok: true as const };
  }, []);

  return {
    hydrated,
    loadError,
    balance: portfolio.balanceUsdc,
    positions: portfolio.positions,
    history: portfolio.history,
    buyPosition,
    sellPosition,
    resetPortfolio,
  };
}
