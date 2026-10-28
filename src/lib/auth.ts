import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { session as roleSession } from "@/lib/session";
import { settings } from "@/lib/settings";
import type { Role } from "@/lib/asset-store";

export interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  nome: string;
  role: Role;
}

let state: AuthState = { loading: true, session: null, user: null, nome: "", role: "viewer" };
let snapshot = state;
const listeners = new Set<() => void>();
let started = false;

function emit() {
  snapshot = { ...state };
  roleSession.set(state.role);
  if (state.nome) settings.set({ nome: state.nome });
  listeners.forEach((l) => l());
}

async function loadProfile(user: User | null) {
  if (!user) {
    state = { loading: false, session: state.session, user: null, nome: "", role: "viewer" };
    emit();
    return;
  }
  const [{ data: perfil }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("nome, email").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  state = {
    loading: false,
    session: state.session,
    user,
    nome: perfil?.nome || user.email?.split("@")[0] || "Usuário",
    role: isAdmin ? "admin" : "viewer",
  };
  emit();
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth.onAuthStateChange((_event, s) => {
    state = { ...state, session: s, user: s?.user ?? null };
    emit();
    setTimeout(() => void loadProfile(s?.user ?? null), 0);
  });
  void supabase.auth.getSession().then(({ data }) => {
    state = { ...state, session: data.session, user: data.session?.user ?? null };
    void loadProfile(data.session?.user ?? null);
  });
}

export const auth = {
  subscribe(l: () => void) {
    start();
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => snapshot,
  async signOut() {
    await supabase.auth.signOut();
    roleSession.setEditMode(false);
    state = { loading: false, session: null, user: null, nome: "", role: "viewer" };
    emit();
  },
  refresh: () => loadProfile(state.user),
};

export function useAuth() {
  const [value, setValue] = useState<AuthState>(snapshot);
  useEffect(() => {
    const l = () => setValue(auth.get());
    const off = auth.subscribe(l);
    l();
    return () => {
      off();
    };
  }, []);
  return value;
}
