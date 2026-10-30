import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Boxes, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · AtivosTI" },
      {
        name: "description",
        content: "Acesse a plataforma AtivosTI para gerenciar o inventário de TI e o mapeamento 3D dos ambientes.",
      },
      { property: "og:title", content: "Entrar · AtivosTI" },
      { property: "og:description", content: "Login e cadastro da plataforma de gestão de ativos de TI." },
    ],
  }),
  component: AuthPage,
});

function sanitizeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"entrar" | "cadastrar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  const next = typeof window !== "undefined" ? sanitizeNext(new URLSearchParams(window.location.search).get("next")) : "/";

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session) window.location.replace(next);
      else setChecking(false);
    });
    return () => {
      alive = false;
    };
  }, [next]);

  const entrar = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setBusy(false);
    if (error) {
      toast("Não foi possível entrar", { description: error.message });
      return;
    }
    navigate({ to: next as never });
  };

  const cadastrar = async () => {
    if (!nome.trim()) {
      toast("Informe seu nome completo.");
      return;
    }
    if (senha.length < 6) {
      toast("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        emailRedirectTo: `${window.location.origin}${next}`,
        data: { nome: nome.trim() },
      },
    });
    setBusy(false);
    if (error) {
      toast("Não foi possível cadastrar", { description: error.message });
      return;
    }
    toast("Conta criada", { description: "Se a confirmação por e-mail estiver ativa, verifique sua caixa de entrada." });
    const { data } = await supabase.auth.getSession();
    if (data.session) navigate({ to: next as never });
    else setTab("entrar");
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast("Falha no login com Google", { description: String(result.error) });
      return;
    }
    if (result.redirected) return;
    window.location.replace(next);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5 text-foreground">
          <Boxes className="h-6 w-6" />
          <span className="text-lg font-semibold tracking-tight">AtivosTI</span>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h1 className="text-lg font-semibold tracking-tight">
            {tab === "entrar" ? "Acessar plataforma" : "Criar conta"}
          </h1>

          <div className="mt-5 flex rounded-md border border-border p-0.5 text-sm">
            {(["entrar", "cadastrar"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-[5px] px-3 py-1.5 transition-colors ${
                  tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {t === "entrar" ? "Entrar" : "Cadastrar"}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4">
            {tab === "cadastrar" && (
              <div className="grid gap-2">
                <Label>Nome completo</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ana Ribeiro" />
              </div>
            )}
            <div className="grid gap-2">
              <Label>E-mail corporativo</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
              />
            </div>
            <div className="grid gap-2">
              <Label>Senha</Label>
              <Input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (tab === "entrar" ? entrar() : cadastrar())}
                placeholder="••••••••"
              />
            </div>
            <Button disabled={busy} onClick={() => (tab === "entrar" ? entrar() : cadastrar())}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tab === "entrar" ? "Entrar" : "Criar conta"}
            </Button>

            <div className="relative py-1 text-center">
              <span className="relative z-10 bg-card px-3 text-xs text-muted-foreground">ou</span>
              <span className="absolute left-0 top-1/2 h-px w-full bg-border" />
            </div>

            <Button variant="outline" disabled={busy} onClick={google}>
              Continuar com Google
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
