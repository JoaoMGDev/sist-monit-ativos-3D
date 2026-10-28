import { useSyncExternalStore } from "react";
import { settings } from "./settings";

export type ActionKind = "add" | "edit" | "move" | "delete" | "sala" | "undo";

export interface ActionLog {
  id: string;
  tipo: ActionKind;
  descricao: string;
  usuario: string;
  criadoEm: number;
}

interface UndoEntry {
  label: string;
  usuario: string;
  revert: () => void;
}

/** Somente ações espaciais/de edição de ativos entram na fila de desfazer. */
const UNDOABLE: ReadonlySet<ActionKind> = new Set<ActionKind>(["add", "edit", "move", "delete"]);

let items: ActionLog[] = [];
let snapshot: ActionLog[] = items;
let undoStack: UndoEntry[] = [];
let canUndoSnapshot = false;
const listeners = new Set<() => void>();

function usuarioAtual() {
  return settings.get().nome;
}

function emit() {
  snapshot = [...items];
  canUndoSnapshot = undoStack.some((e) => e.usuario === usuarioAtual());
  listeners.forEach((l) => l());
}

function push(tipo: ActionKind, descricao: string) {
  items = [
    {
      id: `ac${Date.now()}_${items.length}`,
      tipo,
      descricao,
      usuario: usuarioAtual(),
      criadoEm: Date.now(),
    },
    ...items,
  ].slice(0, 200);
}

export const history = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => snapshot,
  getCanUndo: () => canUndoSnapshot,
  /**
   * Registra uma ação. O `revert` só entra na pilha de desfazer quando o tipo é
   * uma ação de ativo (add/edit/move/delete) — preferências e perfil não são desfeitos.
   */
  record(tipo: ActionKind, descricao: string, revert?: () => void) {
    push(tipo, descricao);
    if (revert && UNDOABLE.has(tipo)) {
      undoStack = [...undoStack, { label: descricao, usuario: usuarioAtual(), revert }].slice(-50);
    }
    emit();
  },
  /** Desfaz apenas a última ação do próprio usuário (fila individual). */
  undo() {
    const me = usuarioAtual();
    for (let i = undoStack.length - 1; i >= 0; i--) {
      const entry = undoStack[i]!;
      if (entry.usuario !== me) continue;
      undoStack = [...undoStack.slice(0, i), ...undoStack.slice(i + 1)];
      entry.revert();
      push("undo", `Desfeita a ação: ${entry.label}`);
      emit();
      return entry.label;
    }
    return null;
  },
  clear() {
    items = [];
    undoStack = [];
    emit();
  },
};

export function useActionLogs() {
  return useSyncExternalStore(history.subscribe, history.get, history.get);
}

export function useCanUndo() {
  return useSyncExternalStore(history.subscribe, history.getCanUndo, history.getCanUndo);
}
