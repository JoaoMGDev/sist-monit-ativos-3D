import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Accessibility,
  LogOut,
  Moon,
  Play,
  SlidersHorizontal,
  User,
  Volume2,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INTERVALOS, settings, useSettings, previewToque } from "@/lib/settings";
import { TOQUES, type ToqueId } from "@/lib/sounds";
import { auth, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";


const SECOES = [
  { id: "perfil", label: "Perfil", icon: User },
  { id: "preferencias", label: "Preferências", icon: SlidersHorizontal },
  { id: "acessibilidade", label: "Acessibilidade", icon: Accessibility },
  { id: "simulacao", label: "Modo Simulação", icon: Zap },
  { id: "sair", label: "Sair", icon: LogOut },
] as const;

type SecaoId = (typeof SECOES)[number]["id"];

function Row({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 rounded-lg border border-border p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
      </div>
      {children}
    </div>
  );
}

function Subtopico({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h4>
      {children}
    </section>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const cfg = useSettings();
  const { user } = useAuth();
  const [secao, setSecao] = useState<SecaoId>("perfil");
  const [nome, setNome] = useState(cfg.nome);

  useEffect(() => {
    if (open) setNome(cfg.nome);
    // Recarrega ao abrir. Incluir cfg.nome sobrescreveria o texto enquanto o usuário digita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const salvarNome = async () => {
    const v = nome.trim();
    if (!v) {
      toast("Informe um nome válido.");
      return;
    }
    settings.set({ nome: v });
    if (user) {
      const { error } = await supabase.from("profiles").update({ nome: v }).eq("id", user.id);
      if (error) {
        toast("Não foi possível salvar o nome", { description: error.message });
        return;
      }
      void auth.refresh();
    }
    toast("Perfil atualizado", { description: `Agora você aparece como ${v}.` });
  };

  const sair = async () => {
    await auth.signOut();
    onOpenChange(false);
    window.location.replace("/auth");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Configurações</DialogTitle>
        </DialogHeader>
        <div className="grid gap-0 md:grid-cols-[210px_1fr]">
          <nav className="scroll-slim flex gap-1 overflow-x-auto border-b border-border p-3 md:flex-col md:border-b-0 md:border-r">

            {SECOES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSecao(s.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  secao === s.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <s.icon className="h-4 w-4" />
                {s.label}
              </button>
            ))}
          </nav>

          <div className="scroll-slim h-[min(60vh,430px)] space-y-5 overflow-y-auto p-6">
            {secao === "perfil" && (
              <>
                <h3 className="text-sm font-semibold">Perfil</h3>
                <div className="grid gap-2">
                  <Label>Alterar nome</Label>
                  <div className="flex gap-2">
                    <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
                    <Button onClick={() => void salvarNome()}>Salvar</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O nome aparece no cabeçalho e é registrado nos novos logs de ação.
                  </p>
                </div>
                {user?.email && (
                  <div className="grid gap-2">
                    <Label>E-mail da conta</Label>
                    <Input value={user.email} disabled />
                  </div>
                )}
              </>
            )}

            {secao === "preferencias" && (
              <>
                <h3 className="text-sm font-semibold">Preferências</h3>

                <Subtopico titulo="Alertas">
                  <Row
                    titulo="Notificações na dashboard"
                    descricao="Alertas flutuantes exibidos no canto da tela."
                  >
                    <Switch
                      checked={cfg.notificacoesVisuais}
                      onCheckedChange={(v) => settings.set({ notificacoesVisuais: v })}
                    />
                  </Row>
                </Subtopico>

                <Subtopico titulo="Som dos alertas">
                  <Row titulo="Aviso sonoro" descricao="Toca um som curto a cada nova notificação.">
                    <Switch checked={cfg.som} onCheckedChange={(v) => settings.set({ som: v })} />
                  </Row>

                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Volume dos alertas</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Intensidade do toque das notificações.
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                        <Volume2 className="h-4 w-4" />
                        {cfg.volume}%
                      </span>
                    </div>
                    <Slider
                      className="mt-4"
                      value={[cfg.volume]}
                      min={0}
                      max={100}
                      step={5}
                      disabled={!cfg.som}
                      onValueChange={([v]) => settings.set({ volume: v ?? 0 })}
                      onValueCommit={([v]) => previewToque(cfg.toque, v ?? 0)}
                    />
                  </div>

                  <Row titulo="Toque das notificações" descricao="Escolha o som preferido para os alertas.">
                    <div className="flex items-center gap-2">
                      <Select
                        value={cfg.toque}
                        onValueChange={(v) => {
                          settings.set({ toque: v as ToqueId });
                          previewToque(v as ToqueId, cfg.volume);
                        }}
                      >
                        <SelectTrigger className="w-[170px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TOQUES.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Ouvir toque"
                        onClick={() => previewToque(cfg.toque, cfg.volume)}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  </Row>
                </Subtopico>


                <Subtopico titulo="Aparência">
                  <Row titulo="Modo Escuro" descricao="Alterna a interface entre tema claro e escuro.">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4 text-muted-foreground" />
                      <Switch
                        checked={cfg.tema === "escuro"}
                        onCheckedChange={(v) => settings.set({ tema: v ? "escuro" : "claro" })}
                      />
                    </div>
                  </Row>
                </Subtopico>

                <Subtopico titulo="Dados e gráficos">
                  <Row
                    titulo="Tempo de atualização dos gráficos"
                    descricao="Frequência de amostragem da linha do tempo da rede."
                  >
                    <Select
                      value={String(cfg.graficoIntervalo)}
                      onValueChange={(v) => settings.set({ graficoIntervalo: Number(v) })}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERVALOS.map((i) => (
                          <SelectItem key={i.valor} value={String(i.valor)}>
                            {i.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Row>
                </Subtopico>
              </>
            )}

            {secao === "acessibilidade" && (
              <>
                <h3 className="text-sm font-semibold">Acessibilidade</h3>
                <Row titulo="Cor de status Online" descricao="Aplicada aos gráficos e modelos 3D.">
                  <input
                    type="color"
                    aria-label="Cor de status online"
                    value={cfg.corOnline}
                    onChange={(e) => settings.set({ corOnline: e.target.value })}
                    className="h-9 w-14 cursor-pointer rounded-md border border-border bg-card"
                  />
                </Row>
                <Row titulo="Cor de status Offline" descricao="Aplicada aos gráficos e modelos 3D.">
                  <input
                    type="color"
                    aria-label="Cor de status offline"
                    value={cfg.corOffline}
                    onChange={(e) => settings.set({ corOffline: e.target.value })}
                    className="h-9 w-14 cursor-pointer rounded-md border border-border bg-card"
                  />
                </Row>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => settings.set({ corOnline: "#4f9d78", corOffline: "#c96a6a" })}
                >
                  Restaurar cores padrão
                </Button>
              </>
            )}

            {secao === "simulacao" && (
              <>
                <h3 className="text-sm font-semibold">Modo Simulação</h3>
                <Row
                  titulo="Iniciar modo simulação"
                  descricao="Simula quedas e retornos de conexão em ativos aleatórios."
                >
                  <Switch checked={cfg.simulacao} onCheckedChange={(v) => settings.set({ simulacao: v })} />
                </Row>
                <p className="text-xs text-muted-foreground">
                  Com a simulação desligada, os status permanecem estáveis e nenhum novo evento é gerado.
                </p>
              </>
            )}

            {secao === "sair" && (
              <>
                <h3 className="text-sm font-semibold">Sair</h3>
                <p className="text-sm text-muted-foreground">
                  Encerra a sessão neste dispositivo e retorna à tela de acesso.
                </p>
                <Button variant="outline" className="text-destructive" onClick={() => void sair()}>
                  <LogOut className="mr-2 h-4 w-4" /> Encerrar sessão
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
