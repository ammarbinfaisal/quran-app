"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface RecitationContextState {
  currentPage: number | undefined;
  currentSurahId: number | undefined;
  currentJuzId: number | undefined;
}

interface RecitationContextValue extends RecitationContextState {
  setCurrentPage: (page: number | undefined) => void;
  setCurrentSurahId: (surahId: number | undefined) => void;
  setCurrentJuzId: (juzId: number | undefined) => void;
  setContext: (context: Partial<RecitationContextState>) => void;
}

const RecitationViewContext = createContext<RecitationContextValue | null>(null);

export function RecitationContextProvider({ children }: { children: ReactNode }) {
  const [currentPage, setCurrentPage] = useState<number | undefined>();
  const [currentSurahId, setCurrentSurahId] = useState<number | undefined>();
  const [currentJuzId, setCurrentJuzId] = useState<number | undefined>();

  const setContext = useCallback((context: Partial<RecitationContextState>) => {
    if (context.currentPage !== undefined) setCurrentPage(context.currentPage);
    if (context.currentSurahId !== undefined) setCurrentSurahId(context.currentSurahId);
    if (context.currentJuzId !== undefined) setCurrentJuzId(context.currentJuzId);
  }, []);

  const value: RecitationContextValue = {
    currentPage,
    currentSurahId,
    currentJuzId,
    setCurrentPage,
    setCurrentSurahId,
    setCurrentJuzId,
    setContext,
  };

  return (
    <RecitationViewContext.Provider value={value}>
      {children}
    </RecitationViewContext.Provider>
  );
}

export function useRecitationContext(): RecitationContextValue {
  const context = useContext(RecitationViewContext);
  if (!context) {
    return {
      currentPage: undefined,
      currentSurahId: undefined,
      currentJuzId: undefined,
      setCurrentPage: () => {},
      setCurrentSurahId: () => {},
      setCurrentJuzId: () => {},
      setContext: () => {},
    };
  }
  return context;
}

/**
 * Hook to update recitation context when view changes.
 * Call this in reader components to keep context in sync.
 */
export function useUpdateRecitationContext(context: Partial<RecitationContextState>) {
  const { setContext } = useRecitationContext();

  const contextKey = JSON.stringify(context);
  const [prevContextKey, setPrevContextKey] = useState("");

  if (prevContextKey !== contextKey) {
    setPrevContextKey(contextKey);
    queueMicrotask(() => setContext(context));
  }
}
