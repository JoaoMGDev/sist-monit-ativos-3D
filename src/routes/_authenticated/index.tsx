import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Download,
  Laptop,
  Monitor,
  Network,
  Pencil,
  Printer,
  Server,
  Wifi,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SalaFormDialog } from "@/components/SalaFormDialog";
import { useAssets, useStatusLogs, useSalas } from "@/hooks/use-assets";
import { CATALOGOS, store, maskIp, isValidIp, type AssetKind, type Patrimonio } from "@/lib/asset-store";

/** Ícones consistentes (Lucide) por tipo de equipamento. */
const KIND_ICON: Record<AssetKind, React.ElementType> = {
  desktop: Monitor,
  notebook: Laptop,
  servidor: Server,
  switch: Network,
  impressora: Printer,
};
import { AssetGlyph } from "@/components/AssetGlyph";
import { AnalyticsCharts } from "@/components/AnalyticsCharts";
import { downloadCsv, printReport, type ReportInput } from "@/lib/report";
import { useSettings } from "@/lib/settings";
import { useRole } from "@/lib/session";
import { useMinhasPermissoes } from "@/lib/permissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Visão Macro · AtivosTI" },
      {
        name: "description",
        content:
          "Dashboard corporativo com inventário de ativos de TI, saúde da rede por sala e alertas globais em tempo real.",
      },
      { property: "og:title", content: "Visão Macro · AtivosTI" },
      {
        property: "og:description",
        content: "Painel geral de ativos de TI e status de rede em tempo real.",
      },
    ],
  }),
  component: Dashboard,
});

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ElementType;
  tone?: "default" | "online" | "offline";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon
          className={
            tone === "offline"
              ? "h-4 w-4 text-status-offline"
              : tone === "online"
                ? "h-4 w-4 text-status-online"
                : "h-4 w-4 text-muted-foreground"
          }
        />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Dashboard() {
  const assets = useAssets();
  const logs = useStatusLogs();
  const salas = useSalas();
  const role = useRole();
  const cfg = useSettings();
  const isAdmin = role === "admin";
  const perms = useMinhasPermissoes();
  const [q, setQ] = useState("");
  const [fSala, setFSala] = useState("todas");
  const [fTipo, setFTipo] = useState("todos");
  const [fStatus, setFStatus] = useState("todos");
  const [detalhe, setDetalhe] = useState<Patrimonio | null>(null);
  const [editando, setEditando] = useState(false);
  const [editForm, setEditForm] = useState({ nome: "", ip: "" });

  const salvarEdicao = () => {
    if (!detalhe) return;
    if (!editForm.nome.trim()) {
      toast("Informe o nome do equipamento.");
      return;
    }
    if (!isValidIp(editForm.ip)) {
      toast("Endereço IP inválido.");
      return;
    }
    if (store.isTaken("ip", editForm.ip, detalhe.id)) {
      toast("Esse endereço IP já está em uso.");
      return;
    }
    store.update(detalhe.id, { nome: editForm.nome.trim(), ip: editForm.ip });
    setDetalhe({ ...detalhe, nome: editForm.nome.trim(), ip: editForm.ip });
    setEditando(false);
    toast("Ativo atualizado", { description: `${detalhe.codigo} teve suas informações alteradas.` });
  };
  const [catalogo, setCatalogo] = useState<string>("todos");

  const salasFiltradas = useMemo(
    () => (catalogo === "todos" ? salas : salas.filter((s) => s.catalogo === catalogo)),
    [salas, catalogo],
  );

  const offline = assets.filter((a) => a.status === "offline");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const salasDoCatalogo = new Set(
      (catalogo === "todos" ? salas : salas.filter((s) => s.catalogo === catalogo)).map((s) => s.id),
    );
    return assets.filter((a) => {
      if (!salasDoCatalogo.has(a.salaId)) return false;
      if (fSala !== "todas" && a.salaId !== fSala) return false;
      if (fTipo !== "todos" && a.tipo !== fTipo) return false;
      if (fStatus !== "todos" && a.status !== fStatus) return false;
      if (!t) return true;
      return (
        a.codigo.includes(t) ||
        a.nome.toLowerCase().includes(t) ||
        a.ip.includes(t) ||
        a.tipo.includes(t)
      );
    });
  }, [assets, salas, catalogo, q, fSala, fTipo, fStatus]);

  const filtrosAtivos =
    (catalogo !== "todos" ? 1 : 0) +
    (fSala !== "todas" ? 1 : 0) +
    (fTipo !== "todos" ? 1 : 0) +
    (fStatus !== "todos" ? 1 : 0);

  const detalheVivo = detalhe ? (assets.find((a) => a.id === detalhe.id) ?? null) : null;

  const reportInput = (): ReportInput => ({
    titulo: "Relatório Geral de Ativos de TI",
    subtitulo: "Visão Macro · inventário consolidado",
    usuario: cfg.nome,
    filtros: [
      { label: "Catálogo", valor: catalogo === "todos" ? "Todos" : catalogo },
      { label: "Busca", valor: q.trim() || "—" },
      { label: "Sala", valor: fSala === "todas" ? "Todas" : (salas.find((s) => s.id === fSala)?.nome ?? "—") },
      { label: "Tipo", valor: fTipo === "todos" ? "Todos" : fTipo },
      { label: "Status", valor: fStatus === "todos" ? "Todos" : fStatus },
    ],
    metricas: [
      { label: "Ativos", valor: filtered.length },
      { label: "Conectados", valor: filtered.filter((a) => a.status === "online").length },
      { label: "Falhas", valor: filtered.filter((a) => a.status === "offline").length },
      { label: "Salas", valor: new Set(filtered.map((a) => a.salaId)).size },
    ],
    rows: filtered,
    salas,
    chartIds: ["chart-timeline", "chart-donut"],
  });

  const exportCsv = () => {
    downloadCsv(reportInput(), "inventario-ativos.csv");
    toast("Relatório CSV exportado", { description: `${filtered.length} ativos incluídos.` });
  };

  const exportPdf = () => {
    if (!printReport(reportInput())) toast("Permita pop-ups para gerar o PDF.");
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão Macro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saúde da rede e inventário consolidado de todos os ambientes.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Exportar relatório">
              <Download className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportCsv}>Exportar CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={exportPdf}>Exportar PDF</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Ativos cadastrados" value={assets.length} hint="Patrimônios monitorados" icon={Server} />
        <Kpi
          label="Conectados"
          value={assets.length - offline.length}
          hint="Respondendo ao monitoramento"
          icon={Wifi}
          tone="online"
        />
        <Kpi
          label="Falhas de rede"
          value={offline.length}
          hint="Requerem atenção imediata"
          icon={AlertTriangle}
          tone="offline"
        />
        <Kpi label="Salas mapeadas" value={salas.length} hint="Ambientes com planta 3D" icon={Activity} />
      </div>

      <AnalyticsCharts />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-lg border border-border bg-card shadow-[var(--shadow-soft)]">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">Ambientes</h2>
            {isAdmin && <SalaFormDialog />}
          </header>
          <div className="flex flex-wrap gap-1.5 border-b border-border px-5 py-3">
            {(["todos", ...CATALOGOS] as const).map((c) => (
              <button
                key={c}
                onClick={() => {
                  setCatalogo(c);
                  if (fSala === "todas" || c === "todos") return;
                  const sala = salas.find((s) => s.id === fSala);
                  if (sala && sala.catalogo !== c) setFSala("todas");
                }}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  catalogo === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {c === "todos" ? "Todos os catálogos" : c}
              </button>
            ))}
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {salasFiltradas.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum ambiente neste catálogo.</p>
            )}
            {salasFiltradas.map((s) => {
              const list = assets.filter((a) => a.salaId === s.id);
              const down = list.filter((a) => a.status === "offline").length;
              return (
                <Link
                  key={s.id}
                  to="/salas/$salaId"
                  params={{ salaId: s.id }}
                  className="rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-accent"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {s.nome} <span className="text-muted-foreground">· sala {s.numero}</span>
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        down
                          ? "bg-status-offline-soft text-status-offline"
                          : "bg-status-online-soft text-status-online"
                      }`}
                    >
                      {down ? `${down} falha(s)` : "Operacional"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.catalogo} · {list.length} ativos · {s.largura}m × {s.profundidade}m
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card shadow-[var(--shadow-soft)]">
          <header className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">Alertas globais</h2>
          </header>
          <ul className="max-h-[320px] divide-y divide-border overflow-auto">
            {logs.length === 0 && (
              <li className="px-5 py-6 text-sm text-muted-foreground">
                Aguardando eventos do monitoramento…
              </li>
            )}
            {logs.slice(0, 12).map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    l.status === "offline" ? "bg-status-offline" : "bg-status-online"
                  }`}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    Patrimônio {l.codigo} — {l.status === "offline" ? "queda de conexão" : "reconectado"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(l.criadoEm).toLocaleTimeString("pt-BR")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-border bg-card shadow-[var(--shadow-soft)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Inventário de patrimônio</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por patrimônio, nome ou IP"
              className="h-9 w-full max-w-xs"
            />
            <Select value={fSala} onValueChange={setFSala}>
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue placeholder="Sala" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as salas</SelectItem>
                {salasFiltradas.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fTipo} onValueChange={setFTipo}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {(["desktop", "notebook", "servidor", "switch", "impressora"] as AssetKind[]).map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="online">Apenas online</SelectItem>
                <SelectItem value="offline">Apenas offline</SelectItem>
              </SelectContent>
            </Select>
            {filtrosAtivos > 0 && (
              <Button
                variant="ghost"
                className="h-9"
                onClick={() => {
                  setCatalogo("todos");
                  setFSala("todas");
                  setFTipo("todos");
                  setFStatus("todos");
                }}
              >
                Limpar filtros ({filtrosAtivos})
              </Button>
            )}
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Patrimônio</th>
                <th className="px-5 py-3 font-medium">Equipamento</th>
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">IP</th>
                <th className="px-5 py-3 font-medium">Sala</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setDetalhe(a)}
                  className="cursor-pointer hover:bg-accent/50"
                >
                  <td className="px-5 py-3 font-medium tabular-nums">{a.codigo}</td>
                  <td className="px-5 py-3">{a.nome}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    <span className="flex items-center gap-2 capitalize">
                      {(() => {
                        const I = KIND_ICON[a.tipo];
                        return <I className="h-4 w-4 shrink-0 opacity-70" />;
                      })()}
                      {a.tipo}
                    </span>
                  </td>
                  <td className="px-5 py-3 tabular-nums text-muted-foreground">{a.ip}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {salas.find((s) => s.id === a.salaId)?.nome}
                    <span className="ml-1 text-xs">· sala {salas.find((s) => s.id === a.salaId)?.numero}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        a.status === "offline"
                          ? "bg-status-offline-soft text-status-offline"
                          : "bg-status-online-soft text-status-online"
                      }`}
                    >
                      {a.status === "offline" ? "Offline" : "Online"}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                    Nenhum ativo corresponde aos filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog
        open={!!detalheVivo}
        onOpenChange={(o) => {
          if (!o) {
            setDetalhe(null);
            setEditando(false);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto scroll-slim sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do ativo</DialogTitle>
          </DialogHeader>
          {detalheVivo && (
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="shrink-0 self-start rounded-lg border border-border bg-muted/40 p-2">
                <AssetGlyph tipo={detalheVivo.tipo} status={detalheVivo.status} size={120} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                  {(() => {
                    const I = KIND_ICON[detalheVivo.tipo];
                    return <I className="h-3.5 w-3.5" />;
                  })()}
                  {detalheVivo.tipo}
                </p>
                <h3 className="truncate text-lg font-semibold tracking-tight">{detalheVivo.nome}</h3>
                <span
                  className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    detalheVivo.status === "offline"
                      ? "bg-status-offline-soft text-status-offline"
                      : "bg-status-online-soft text-status-online"
                  }`}
                >
                  {detalheVivo.status === "offline" ? "Offline" : "Online"}
                </span>

                {editando ? (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-1.5">
                      <span className="text-xs text-muted-foreground">Nome do equipamento</span>
                      <Input
                        value={editForm.nome}
                        onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <span className="text-xs text-muted-foreground">Endereço IP</span>
                      <Input
                        value={editForm.ip}
                        onChange={(e) => setEditForm((f) => ({ ...f, ip: maskIp(e.target.value) }))}
                        inputMode="numeric"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setEditando(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={salvarEdicao}>Salvar alterações</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <dl className="mt-4 space-y-2 text-sm">
                      {[
                        ["Código de patrimônio", detalheVivo.codigo],
                        ["Descrição", `${detalheVivo.nome} · equipamento do tipo ${detalheVivo.tipo}`],
                        [
                          "Sala / ambiente",
                          (() => {
                            const s = salas.find((r) => r.id === detalheVivo.salaId);
                            return s ? `${s.nome} · sala ${s.numero}` : "—";
                          })(),
                        ],
                        ["Endereço IP", detalheVivo.ip],
                        ["Posição na grade", `${detalheVivo.x.toFixed(1)}m · ${detalheVivo.z.toFixed(1)}m`],
                        ["Atualizado em", new Date(detalheVivo.atualizadoEm).toLocaleString("pt-BR")],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4 border-b border-border/60 pb-1.5">
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd className="text-right font-medium">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      {perms.editar && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditForm({ nome: detalheVivo.nome, ip: detalheVivo.ip });
                            setEditando(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" /> Editar informações
                        </Button>
                      )}
                      <Link
                        to="/salas/$salaId"
                        params={{ salaId: detalheVivo.salaId }}
                        className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                      >
                        Abrir no mapa 3D
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
