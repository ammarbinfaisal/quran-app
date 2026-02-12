"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  persistSettingsToBrowser,
  readSettingsFromLocalStorage,
  settingsEqual,
  type Settings,
} from "@/lib/preferences";

interface SettingsStoreState {
  settings: Settings;
  hydrated: boolean;
  updateSettings: (partial: Partial<Settings>) => void;
  replaceSettings: (incoming: Settings) => void;
  hydrateFromStorage: () => void;
}

type SettingsStore = StoreApi<SettingsStoreState>;

function createSettingsStore(initialSettings: Settings): SettingsStore {
  return createStore<SettingsStoreState>()((set, get) => ({
    settings: normalizeSettings(initialSettings),
    hydrated: false,
    updateSettings: (partial) => {
      const next = normalizeSettings({ ...get().settings, ...partial });
      persistSettingsToBrowser(next);
      set({ settings: next });
    },
    replaceSettings: (incoming) => {
      const next = normalizeSettings(incoming);
      persistSettingsToBrowser(next);
      set({ settings: next });
    },
    hydrateFromStorage: () => {
      const fromStorage = readSettingsFromLocalStorage();
      const serverSettings = get().settings;

      // Cookie/server snapshot is authoritative unless still default.
      const shouldAdoptStorage =
        fromStorage &&
        settingsEqual(serverSettings, DEFAULT_SETTINGS) &&
        !settingsEqual(fromStorage, DEFAULT_SETTINGS);

      const next = shouldAdoptStorage ? fromStorage : serverSettings;
      persistSettingsToBrowser(next);
      set({ settings: next, hydrated: true });
    },
  }));
}

const SettingsStoreContext = createContext<SettingsStore | null>(null);

export function SettingsProvider({
  children,
  initialSettings,
}: {
  children: ReactNode;
  initialSettings: Settings;
}) {
  const [store] = useState<SettingsStore>(() =>
    createSettingsStore(initialSettings)
  );

  useEffect(() => {
    store.getState().replaceSettings(initialSettings);
  }, [initialSettings, store]);

  useEffect(() => {
    store.getState().hydrateFromStorage();
  }, [store]);

  return (
    <SettingsStoreContext.Provider value={store}>
      {children}
    </SettingsStoreContext.Provider>
  );
}

export function useSettings() {
  const store = useContext(SettingsStoreContext);
  if (!store) {
    throw new Error("useSettings must be used within SettingsProvider");
  }

  const settings = useStore(store, (state) => state.settings);
  const hydrated = useStore(store, (state) => state.hydrated);
  const updateSettings = useStore(store, (state) => state.updateSettings);

  return { settings, hydrated, updateSettings };
}
