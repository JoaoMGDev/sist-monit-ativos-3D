import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PERMISSOES_LABEL,
  permissoes as permStore,
  usePermissoesMap,
  type Permissoes,
} from "@/lib/permissions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel Admin · AtivosTI" },
      {
        name: "description",
        content: "Gerencie os usuários da plataforma AtivosTI e defina quem é Administrador ou Visualizador.",
      },
      { property: "og:title", content: "Painel Admin · AtivosTI" },
      { property: "og:description", content: "Gestão de usuários e cargos da plataforma AtivosTI." },
    ],
  }),
  component: AdminUsuarios,
});

interface Linha {
  id: string;
  nome: string;
  email: string;
  role: "admin" | "viewer";
}

function AdminUsuarios() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  usePermissoesMap();

  const alternarPermissao = (alvo: Linha, chave: keyof Permissoes, valor: boolean) => {
    permStore.set(alvo.id, { [chave]: valor }, alvo.role);
  };


  const carregar = useCallback(async () => {
    setCarregando(true);
    const [{ data: perfis, error: e1 }, { data: roles, error: e2 }] = await Promise.all([
      supabase.from("profiles").select("id, nome, email").order("created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    setCarregando(false);
    if (e1 || e2) {
      toast("Não foi possível carregar os usuários", { description: (e1 ?? e2)?.message });
      return;
    }
    setLinhas(
      (perfis ?? []).map((p) => ({
        id: p.id,
        nome: p.nome,
        email: p.email,
        role: (roles ?? []).some((r) => r.user_id === p.id && r.role === "admin") ? "admin" : "viewer",
      })),
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const alterarCargo = async (alvo: Linha, novo: "admin" | "viewer") => {
    if (alvo.role === novo) return;
    if (alvo.id === user?.id) {
      toast("Você não pode alterar o próprio cargo.");
      return;
    }
    setSalvando(alvo.id);
    const del = await supabase.from("user_roles").delete().eq("user_id", alvo.id);
    const ins = del.error ? del : await supabase.from("user_roles").insert({ user_id: alvo.id, role: novo });
    setSalvando(null);
    if (ins.error) {
      toast("Falha ao atualizar cargo", { description: ins.error.message });
      void carregar();
      return;
    }
    permStore.reset(alvo.id);
    setLinhas((prev) => prev.map((l) => (l.id === alvo.id ? { ...l, role: novo } : l)));

    toast("Cargo atualizado", {
      description: `${alvo.nome || alvo.email} agora é ${novo === "admin" ? "Administrador" : "Visualizador"}.`,
    });
  };

  return (
    <AppShell>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Painel Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Usuários cadastrados na plataforma e seus níveis de acesso.
        </p>
      </div>

      {!isAdmin ? (
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          <Lock className="h-4 w-4" /> Área restrita a administradores.
        </div>
      ) : (
        <section className="mt-6 overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-soft)]">
          <header className="flex items-center gap-2 border-b border-border px-5 py-4">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Usuários e cargos</h2>
          </header>
          {carregando ? (
            <div className="flex items-center gap-2 px-5 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando usuários…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Usuário</th>
                    <th className="px-5 py-3 font-medium">E-mail</th>
                    <th className="px-5 py-3 font-medium">Cargo</th>
                    <th className="px-5 py-3 font-medium">Permissões específicas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {linhas.map((l) => {
                    const eu = l.id === user?.id;
                    const perms = permStore.de(l.id, l.role);
                    return (
                      <tr key={l.id} className="hover:bg-accent/50">
                        <td className="px-5 py-3 font-medium">
                          {l.nome || "—"}
                          {eu && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{l.email}</td>
                        <td className="px-5 py-3">
                          <Select
                            value={l.role}
                            disabled={eu || salvando === l.id}
                            onValueChange={(v) => void alterarCargo(l, v as "admin" | "viewer")}
                          >
                            <SelectTrigger className="h-9 w-[190px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="viewer">Visualizador</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-x-5 gap-y-2">
                            {PERMISSOES_LABEL.map((p) => (
                              <label
                                key={p.id}
                                className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
                              >
                                <Checkbox
                                  checked={perms[p.id]}
                                  disabled={eu}
                                  onCheckedChange={(v) => alternarPermissao(l, p.id, v === true)}
                                />
                                {p.label}
                              </label>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            Por segurança, administradores não podem rebaixar a si mesmos. Administradores recebem todas as
            permissões por padrão.
          </p>
        </section>
      )}

    </AppShell>
  );
}
