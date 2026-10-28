import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  Boxes,
  Crosshair,
  GraduationCap,
  ScrollText,
  Search,
  Settings,
  LogOut,
  ShieldCheck,
  Users,
} from "lucide-react";
import { connectMonitoring, store } from "@/lib/asset-store";
import { notifications, useNotifications } from "@/lib/notifications";
import { useEditMode } from "@/lib/session";
import { settings, useSettings, iniciaisDe, playPing } from "@/lib/settings";
import { auth, useAuth } from "@/lib/auth";
import { focusBus } from "@/lib/focus-bus";
import { SettingsDialog } from "@/components/SettingsDialog";
import { TutorialDialog } from "@/components/TutorialDialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Botão discreto usado nos alertas para abrir a sala e centralizar a câmera. */
function LocalizarBotao({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-muted-foreground/80 opacity-70 transition-all hover:bg-accent/60 hover:text-foreground hover:opacity-100"
    >
      <Crosshair className="h-3 w-3" /> Localizar
    </button>
  );
}

function MonitoringBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    settings.hydrate();
    return connectMonitoring(({ asset, status }) => {
      const titulo =
        status === "offline"
          ? `Falha de conexão · ${asset.codigo}`
          : `Conexão restabelecida · ${asset.codigo}`;
      const descricao =
        status === "offline" ? `${asset.nome} — ${asset.ip} não responde.` : `${asset.nome} voltou a responder.`;
      notifications.push({
        titulo,
        descricao,
        status,
        patrimonioId: asset.id,
        salaId: asset.salaId,
        codigo: asset.codigo,
      });
      playPing();
      if (settings.get().notificacoesVisuais) {
        toast(titulo, {
          description: descricao,
          action: {
            label: "Localizar",
            onClick: () => {
              void navigate({ to: "/salas/$salaId", params: { salaId: asset.salaId } });
              focusBus.request(asset.id);
            },
          },
          classNames: {
            actionButton:
              "!bg-transparent !text-muted-foreground !opacity-70 !shadow-none hover:!opacity-100 hover:!text-foreground !font-medium",
          },
        });
      }
    });
  }, [navigate]);
  return null;
}

function NotificationBell() {
  const list = useNotifications();
  const navigate = useNavigate();
  const unread = list.filter((n) => !n.lida).length;

  const localizar = (salaId?: string, patrimonioId?: string) => {
    if (!salaId || !patrimonioId) return;
    void navigate({ to: "/salas/$salaId", params: { salaId } });
    focusBus.request(patrimonioId);
  };

  return (
    <DropdownMenu onOpenChange={(o) => o && notifications.markAllRead()}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Notificações em tempo real"
          className="relative rounded-md p-2 transition-colors hover:bg-primary-foreground/10"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">Notificações</span>
          <button
            onClick={() => notifications.clear()}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Limpar
          </button>
        </div>
        <ul className="scroll-slim max-h-80 divide-y divide-border overflow-auto">
          {list.length === 0 && (
            <li className="px-4 py-6 text-sm text-muted-foreground">Nenhum alerta em tempo real.</li>
          )}
          {list.map((n) => (
            <li key={n.id} className="flex gap-3 px-4 py-3">
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  n.status === "offline" ? "bg-status-offline" : "bg-status-online",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{n.titulo}</p>
                <p className="text-xs text-muted-foreground">{n.descricao}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(n.criadoEm).toLocaleTimeString("pt-BR")}
                  </span>
                  {n.patrimonioId && (
                    <LocalizarBotao onClick={() => localizar(n.salaId, n.patrimonioId)} />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-border p-2">
          <Link
            to="/logs"
            className="block rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Ver histórico completo de logs
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GlobalSearch({ className }: { className?: string }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const buscar = () => {
    const t = q.trim();
    if (!t) return;
    const hit = store
      .getAssets()
      .find(
        (a) =>
          a.codigo === t ||
          a.codigo.includes(t) ||
          a.nome.toLowerCase().includes(t.toLowerCase()) ||
          a.ip === t,
      );
    if (!hit) {
      toast("Patrimônio não localizado", { description: `Nenhum ativo corresponde a "${t}".` });
      return;
    }
    void navigate({ to: "/salas/$salaId", params: { salaId: hit.salaId } });
    focusBus.request(hit.id);
    toast(`Centralizado no patrimônio ${hit.codigo}`, { description: hit.nome });
  };

  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && buscar()}
        placeholder="Buscar patrimônio..."
        className="h-9 border-primary-foreground/20 bg-primary-foreground/10 pr-9 text-primary-foreground placeholder:text-primary-foreground/50"
      />
      <button
        onClick={buscar}
        aria-label="Localizar patrimônio"
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-primary-foreground/70 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground"
      >
        <Search className="h-4 w-4" />
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { role, nome } = useAuth();
  const editMode = useEditMode();
  const cfg = useSettings();
  const [configOpen, setConfigOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const displayName = nome || cfg.nome;

  /** Onboarding automático apenas no primeiro acesso. */
  useEffect(() => {
    settings.hydrate();
    if (!settings.get().tutorialVisto) {
      setTutorialOpen(true);
      settings.set({ tutorialVisto: true });
    }
  }, []);

  const navItem = (active: boolean) =>
    cn(
      "whitespace-nowrap rounded-md px-2.5 py-1.5 transition-colors hover:bg-primary-foreground/10 sm:px-3",
      active && "bg-primary-foreground/15 font-medium",
    );

  const sair = async () => {
    await auth.signOut();
    window.location.replace("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <MonitoringBridge />
      <header className="sticky top-0 z-30 border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex min-h-16 max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 lg:flex-nowrap lg:gap-5 lg:py-0">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <Boxes className="h-5 w-5 opacity-90" />
            <span className="text-[15px] font-semibold tracking-tight">AtivosTI</span>
          </Link>
          <nav className="flex shrink-0 items-center gap-1 text-sm">
            <Link to="/" className={navItem(path === "/")}>
              Visão Macro
            </Link>
            <Link to="/salas/$salaId" params={{ salaId: "s1" }} className={navItem(path.startsWith("/salas"))}>
              Visão Micro
            </Link>
          </nav>

          <GlobalSearch className="order-last hidden min-w-0 lg:order-none lg:mx-auto lg:block" />

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <span className="hidden items-center gap-1.5 rounded-md bg-primary-foreground/10 px-2.5 py-1.5 text-xs xl:flex">
              <ShieldCheck className="h-3.5 w-3.5" />
              {role === "admin" ? "Administrador" : "Visualizador"}
            </span>
            <Link
              to="/logs"
              aria-label="Histórico de logs"
              title="Histórico de logs"
              className={cn(
                "rounded-md p-2 transition-colors hover:bg-primary-foreground/10",
                path.startsWith("/logs") && "bg-primary-foreground/15",
              )}
            >
              <ScrollText className="h-[18px] w-[18px]" />
            </Link>
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 border-l border-primary-foreground/15 pl-2 text-left transition-opacity hover:opacity-90 sm:pl-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 text-xs font-semibold">
                    {iniciaisDe(displayName)}
                  </span>
                  <span className="hidden min-w-0 leading-tight md:block">
                    <span className="block max-w-[140px] truncate text-xs font-medium">{displayName}</span>
                    <span className="block text-[11px] text-primary-foreground/60">
                      {role === "admin" ? "Administrador" : "Visualizador"}
                    </span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <span className="block text-sm font-medium">{displayName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {role === "admin" ? "Administrador" : "Visualizador"}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {role === "admin" && (
                  <>
                    <DropdownMenuItem onSelect={() => void navigate({ to: "/admin" })}>
                      <Users className="mr-2 h-4 w-4" /> Painel Administrativo
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onSelect={() => setTutorialOpen(true)}>
                  <GraduationCap className="mr-2 h-4 w-4" /> Tutorial
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setConfigOpen(true)}>
                  <Settings className="mr-2 h-4 w-4" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onSelect={() => void sair()}>
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <GlobalSearch className="w-full max-w-none lg:hidden" />
        </div>
      </header>
      {editMode && (
        <div className="border-b border-border bg-status-online-soft px-4 py-2 text-center text-xs text-foreground sm:px-6">
          Modo Edição ativo — arraste os ativos no mapa 3D ou na planta 2D para realocá-los na grade.
        </div>
      )}
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <SettingsDialog open={configOpen} onOpenChange={setConfigOpen} />
      <TutorialDialog open={tutorialOpen} onOpenChange={setTutorialOpen} />
    </div>
  );
}
