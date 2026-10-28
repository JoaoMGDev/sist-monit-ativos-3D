import { useSyncExternalStore } from "react";
import type { Role } from "./asset-store";

let role: Role = "viewer";
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
    const changed = role !== next;
    role = next;
    if (changed) editMode = false;
    emit();
  },
  getEditMode: () => editMode,
  setEditMode(next: boolean) {
    editMode = next;
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
