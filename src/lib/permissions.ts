import { useSyncExternalStore } from "react";
import { useAuth } from "./auth";

/** Permissões granulares por usuário (camada de MVP persistida localmente). */
export interface Permissoes {
  mover: boolean;
  editar: boolean;
  excluir: boolean;
  transferir: boolean;
}

export const PERMISSOES_LABEL: { id: keyof Permissoes; label: string }[] = [
  { id: "mover", label: "Pode mover" },
  { id: "editar", label: "Pode editar" },
  { id: "excluir", label: "Pode excluir" },
  { id: "transferir", label: "Pode transferir" },
];

export const TODAS: Permissoes = { mover: true, editar: true, excluir: true, transferir: true };
export const NENHUMA: Permissoes = { mover: false, editar: false, excluir: false, transferir: false };

const KEY = "ativosti.permissoes";

let mapa: Record<string, Permissoes> = {};
let snapshot = mapa;
const listeners = new Set<() => void>();
let hydrated = false;

function persist() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(mapa));
  } catch {
    /* ignore */
  }
}

function emit() {
  snapshot = { ...mapa };
  persist();
  listeners.forEach((l) => l());
}

export const permissoes = {
  subscribe(l: () => void) {
    permissoes.hydrate();
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => snapshot,
  hydrate() {
    if (hydrated || typeof localStorage === "undefined") return;
    hydrated = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) mapa = JSON.parse(raw) as Record<string, Permissoes>;
    } catch {
      /* ignore */
    }
    snapshot = { ...mapa };
  },
  /** Admin tem todas as permissões por padrão; visualizador parte de nenhuma. */
  de(userId: string, role: "admin" | "viewer"): Permissoes {
    const salvo = snapshot[userId];
    if (salvo) return salvo;
    return role === "admin" ? TODAS : NENHUMA;
  },
  set(userId: string, patch: Partial<Permissoes>, role: "admin" | "viewer") {
    const atual = permissoes.de(userId, role);
    mapa = { ...mapa, [userId]: { ...atual, ...patch } };
    emit();
  },
  reset(userId: string) {
    const { [userId]: _omit, ...resto } = mapa;
    mapa = resto;
    emit();
  },
};

export function usePermissoesMap() {
  return useSyncExternalStore(permissoes.subscribe, permissoes.get, permissoes.get);
}

/** Permissões do usuário logado. Enquanto a sessão carrega, nada é liberado. */
export function useMinhasPermissoes(): Permissoes {
  const { user, role, loading } = useAuth();
  const map = usePermissoesMap();
  if (loading || !user) return NENHUMA;
  return map[user.id] ?? (role === "admin" ? TODAS : NENHUMA);
}
