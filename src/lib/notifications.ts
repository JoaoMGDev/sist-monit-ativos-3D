import { useSyncExternalStore } from "react";
import type { Status } from "./asset-store";

export interface Notificacao {
  id: string;
  titulo: string;
  descricao: string;
  status: Status;
  criadoEm: number;
  lida: boolean;
  /** Permite o botão "Localizar" abrir a sala e centralizar a câmera no ativo. */
  patrimonioId?: string;
  salaId?: string;
  codigo?: string;
}

let items: Notificacao[] = [];
let snapshot = items;
const listeners = new Set<() => void>();

function emit() {
  snapshot = [...items];
  listeners.forEach((l) => l());
}

export const notifications = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => snapshot,
  push(n: Omit<Notificacao, "id" | "criadoEm" | "lida">) {
    items = [{ ...n, id: `n${Date.now()}_${items.length}`, criadoEm: Date.now(), lida: false }, ...items].slice(0, 50);
    emit();
  },
  markAllRead() {
    items = items.map((n) => ({ ...n, lida: true }));
    emit();
  },
  clear() {
    items = [];
    emit();
  },
};

export function useNotifications() {
  return useSyncExternalStore(notifications.subscribe, notifications.get, notifications.get);
}
