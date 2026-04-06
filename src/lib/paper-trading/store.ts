"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  createInitialPaperPortfolioState,
  type PaperPortfolioState,
} from "@/lib/paper-trading/types";

type PaperTradingStore = {
  portfolio: PaperPortfolioState;
  hydrated: boolean;
  setPortfolio: (next: PaperPortfolioState) => void;
  resetPortfolio: () => void;
};

const PERSIST_KEY = "paper-trading-v1";

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const usePaperTradingStore = create<PaperTradingStore>()(
  persist(
    (set) => ({
      portfolio: createInitialPaperPortfolioState(),
      hydrated: false,
      setPortfolio: (next) => set({ portfolio: next }),
      resetPortfolio: () => set({ portfolio: createInitialPaperPortfolioState() }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : noopStorage
      ),
      partialize: (state) => ({ portfolio: state.portfolio }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<PaperTradingStore>),
        hydrated: true,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (!error && state) {
          state.hydrated = true;
        }
      },
    }
  )
);
