import { useSyncExternalStore } from "react";
import type { Role } from "./asset-store";

let role: Role = "admin";
let editMode = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const session = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => role,
  set(next: Role) {
    role = next;
    if (next !== "admin") editMode = false;
    emit();
  },
  getEditMode: () => editMode,
  setEditMode(next: boolean) {
    editMode = role === "admin" ? next : false;
    emit();
  },
  toggleEditMode() {
    session.setEditMode(!editMode);
  },
};

export const usuarioAtual = {
  nome: "Ana Ribeiro",
  email: "ana.ribeiro@empresa.com",
  iniciais: "AR",
};

export function useRole() {
  return useSyncExternalStore(session.subscribe, session.get, session.get);
}

export function useEditMode() {
  return useSyncExternalStore(session.subscribe, session.getEditMode, session.getEditMode);
}
