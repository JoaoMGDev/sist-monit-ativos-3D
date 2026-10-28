import { useSyncExternalStore } from "react";
import { tocarToque, type ToqueId } from "./sounds";

export type Tema = "claro" | "escuro";

export interface AppSettings {
  nome: string;
  notificacoesVisuais: boolean;
  som: boolean;
  /** Volume dos alertas sonoros (0..100). */
  volume: number;
  /** Toque escolhido para as notificações. */
  toque: ToqueId;
  simulacao: boolean;
  tema: Tema;
  /** Intervalo de amostragem dos gráficos, em milissegundos. */
  graficoIntervalo: number;
  corOnline: string;
  corOffline: string;
  /** Onboarding já exibido para este navegador/conta. */
  tutorialVisto: boolean;
}

const DEFAULTS: AppSettings = {
  nome: "Usuário",
  notificacoesVisuais: true,
  som: true,
  volume: 60,
  toque: "ping",
  simulacao: true,
  tema: "claro",
  graficoIntervalo: 10000,
  corOnline: "#4f9d78",
  corOffline: "#c96a6a",
  tutorialVisto: false,
};

export const INTERVALOS = [
  { valor: 10000, label: "10 segundos" },
  { valor: 30000, label: "30 segundos" },
  { valor: 60000, label: "1 minuto" },
] as const;


const KEY = "ativosti.settings";

let state: AppSettings = { ...DEFAULTS };
let snapshot: AppSettings = state;
const listeners = new Set<() => void>();

function applyCssVars() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--status-online", state.corOnline);
  root.style.setProperty("--status-offline", state.corOffline);
  root.style.setProperty("--status-online-soft", `color-mix(in srgb, ${state.corOnline} 16%, white)`);
  root.style.setProperty("--status-offline-soft", `color-mix(in srgb, ${state.corOffline} 16%, white)`);
  root.classList.toggle("dark", state.tema === "escuro");
}

function emit() {
  snapshot = { ...state };
  applyCssVars();
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}

export const settings = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => snapshot,
  getServer: () => snapshot,
  set(patch: Partial<AppSettings>) {
    state = { ...state, ...patch };
    emit();
  },
  reset() {
    state = { ...DEFAULTS };
    emit();
  },
  hydrate() {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) };
    } catch {
      /* ignore */
    }
    emit();
  },
};

export function useSettings() {
  return useSyncExternalStore(settings.subscribe, settings.get, settings.getServer);
}

export const iniciaisDe = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "US";

/** Toca o toque configurado pelo usuário, respeitando volume e preferência de som. */
export function playPing() {
  const cfg = settings.get();
  if (!cfg.som) return;
  tocarToque(cfg.toque, cfg.volume / 100);
}

/** Pré-escuta usada nas Configurações. */
export function previewToque(toque: ToqueId, volume: number) {
  tocarToque(toque, volume / 100);
}

