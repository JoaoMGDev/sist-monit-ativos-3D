import { useSyncExternalStore } from "react";
import { store } from "@/lib/asset-store";

export function useAssets() {
  return useSyncExternalStore(store.subscribe, store.getAssets, store.getAssets);
}

export function useStatusLogs() {
  return useSyncExternalStore(store.subscribe, store.getLogs, store.getLogs);
}

export function useSalas() {
  return useSyncExternalStore(store.subscribe, store.getSalas, store.getSalas);
}
