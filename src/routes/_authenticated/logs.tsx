import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Filter } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useStatusLogs, useAssets, useSalas } from "@/hooks/use-assets";
import { useActionLogs } from "@/lib/history";
import { csvField } from "@/lib/report";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


export const Route = createFileRoute("/_authenticated/logs")({
  head: () => ({
    meta: [
      { title: "Histórico de Logs · AtivosTI" },
      {
        name: "description",
        content:
          "Histórico completo de eventos de rede dos ativos de TI: quedas de conexão, reconexões, sala e horário.",
      },
      { property: "og:title", content: "Histórico de Logs · AtivosTI" },
      {
        property: "og:description",
        content: "Tabela de auditoria com todos os eventos de status dos patrimônios monitorados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LogsPage,
});

const ACAO_LABEL: Record<string, string> = {
  add: "Adição",
  edit: "Edição",
  move: "Movimentação",
  delete: "Exclusão",
  sala: "Ambiente",
  undo: "Desfazer",
};

function LogsPage() {
  const logs = useStatusLogs();
  const acoes = useActionLogs();
  const assets = useAssets();
  const salas = useSalas();
  const [aba, setAba] = useState<"acoes" | "rede">("acoes");
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<"todos" | "offline" | "online">("todos");
  const [fSala, setFSala] = useState("todas");
  const [fUsuario, setFUsuario] = useState("todos");
  const [fAtivo, setFAtivo] = useState("todos");

  const usuarios = useMemo(
    () => Array.from(new Set(acoes.map((a) => a.usuario))).sort(),
    [acoes],
  );

  const salaDoAtivo = (patrimonioId?: string) =>
    salas.find((s) => s.id === assets.find((p) => p.id === patrimonioId)?.salaId);

  const acoesFiltradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    const ativo = assets.find((a) => a.id === fAtivo);
    const sala = salas.find((s) => s.id === fSala);
    return acoes.filter((a) => {
      const d = a.descricao.toLowerCase();
      if (fUsuario !== "todos" && a.usuario !== fUsuario) return false;
      if (ativo && !d.includes(ativo.codigo.toLowerCase())) return false;
      if (sala && !d.includes(sala.nome.toLowerCase())) return false;
      if (!t) return true;
      return d.includes(t) || a.usuario.toLowerCase().includes(t);
    });
  }, [acoes, q, fUsuario, fAtivo, fSala, assets, salas]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return logs
      .filter((l) => (tipo === "todos" ? true : l.status === tipo))
      .filter((l) => (fAtivo === "todos" ? true : l.patrimonioId === fAtivo))
      .filter((l) => (fSala === "todas" ? true : salaDoAtivo(l.patrimonioId)?.id === fSala))
      .filter((l) => {
        if (!t) return true;
        const a = assets.find((p) => p.id === l.patrimonioId);
        return l.codigo.includes(t) || (a?.nome.toLowerCase().includes(t) ?? false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, assets, salas, q, tipo, fAtivo, fSala]);

  const limparFiltros = () => {
    setFSala("todas");
    setFUsuario("todos");
    setFAtivo("todos");
  };
  const filtrosAtivos =
    (fSala !== "todas" ? 1 : 0) + (fUsuario !== "todos" ? 1 : 0) + (fAtivo !== "todos" ? 1 : 0);


  const exportCsv = () => {
    const linhas =
      aba === "acoes"
        ? [
            "data;hora;acao;descricao;usuario",
            ...acoesFiltradas.map((a) =>
              [
                new Date(a.criadoEm).toLocaleDateString("pt-BR"),
                new Date(a.criadoEm).toLocaleTimeString("pt-BR"),
                ACAO_LABEL[a.tipo] ?? a.tipo,
                a.descricao,
                a.usuario,
              ]
                .map(csvField)
                .join(";"),
            ),
          ]
        : [
            "patrimonio;evento;sala;data_hora",
            ...rows.map((l) => {
              const a = assets.find((p) => p.id === l.patrimonioId);
              return [
                l.codigo,
                l.status === "offline" ? "Queda de conexão" : "Reconexão",
                salas.find((s) => s.id === a?.salaId)?.nome ?? "-",
                new Date(l.criadoEm).toLocaleString("pt-BR"),
              ]
                .map(csvField)
                .join(";");
            }),
          ];
    const blob = new Blob(["\ufeff" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = aba === "acoes" ? "logs-acoes.csv" : "logs-monitoramento.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Histórico de Logs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registro auditável de todos os eventos de rede recebidos do monitoramento.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="mt-6 flex w-full max-w-full overflow-x-auto rounded-md border border-border p-0.5 text-sm sm:w-fit">
        {(["acoes", "rede"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setAba(t)}
            className={`whitespace-nowrap rounded-[5px] px-3 py-1.5 transition-colors ${
              aba === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t === "acoes" ? "Ações de usuário" : "Eventos de rede"}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-soft)]">
        <span className="flex items-center gap-1.5 pl-1 pr-1 text-xs font-medium text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filtros
        </span>
        <Select value={fSala} onValueChange={setFSala}>
          <SelectTrigger className="h-9 w-full sm:w-[180px]">
            <SelectValue placeholder="Sala" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as salas</SelectItem>
            {salas.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.nome} · sala {s.numero}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fAtivo} onValueChange={setFAtivo}>
          <SelectTrigger className="h-9 w-full sm:w-[220px]">
            <SelectValue placeholder="Ativo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os ativos</SelectItem>
            {assets.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.codigo} · {a.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fUsuario} onValueChange={setFUsuario} disabled={aba === "rede"}>
          <SelectTrigger className="h-9 w-full sm:w-[180px]">
            <SelectValue placeholder="Usuário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os usuários</SelectItem>
            {usuarios.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtrosAtivos > 0 && (
          <Button variant="ghost" className="h-9" onClick={limparFiltros}>
            Limpar filtros ({filtrosAtivos})
          </Button>
        )}
      </div>


      {aba === "rede" && (
      <section className="mt-6 rounded-lg border border-border bg-card shadow-[var(--shadow-soft)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex rounded-md border border-border p-0.5 text-sm">
            {(["todos", "offline", "online"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`rounded-[5px] px-3 py-1.5 capitalize transition-colors ${
                  tipo === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {t === "todos" ? "Todos" : t === "offline" ? "Quedas" : "Reconexões"}
              </button>
            ))}
          </div>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por patrimônio ou equipamento"
            className="h-9 w-full max-w-xs"
          />
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Patrimônio</th>
                <th className="px-5 py-3 font-medium">Equipamento</th>
                <th className="px-5 py-3 font-medium">Sala</th>
                <th className="px-5 py-3 font-medium">Evento</th>
                <th className="px-5 py-3 font-medium">Data / hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    Nenhum evento registrado até o momento.
                  </td>
                </tr>
              )}
              {rows.map((l) => {
                const a = assets.find((p) => p.id === l.patrimonioId);
                return (
                  <tr key={l.id} className="hover:bg-accent/50">
                    <td className="px-5 py-3 font-medium tabular-nums">{l.codigo}</td>
                    <td className="px-5 py-3">{a?.nome ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {salas.find((s) => s.id === a?.salaId)?.nome ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          l.status === "offline"
                            ? "bg-status-offline-soft text-status-offline"
                            : "bg-status-online-soft text-status-online"
                        }`}
                      >
                        {l.status === "offline" ? "Queda de conexão" : "Reconexão"}
                      </span>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">
                      {new Date(l.criadoEm).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {aba === "acoes" && (
        <section className="mt-6 rounded-lg border border-border bg-card shadow-[var(--shadow-soft)]">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">Ações de usuário</h2>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por descrição ou usuário"
              className="h-9 w-full max-w-xs"
            />
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 font-medium">Hora</th>
                  <th className="px-5 py-3 font-medium">Ação</th>
                  <th className="px-5 py-3 font-medium">Descrição</th>
                  <th className="px-5 py-3 font-medium">Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {acoesFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                      Nenhuma ação registrada até o momento.
                    </td>
                  </tr>
                )}
                {acoesFiltradas.map((a) => (
                  <tr key={a.id} className="hover:bg-accent/50">
                    <td className="px-5 py-3 tabular-nums">
                      {new Date(a.criadoEm).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">
                      {new Date(a.criadoEm).toLocaleTimeString("pt-BR")}
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                        {ACAO_LABEL[a.tipo] ?? a.tipo}
                      </span>
                    </td>
                    <td className="px-5 py-3">{a.descricao}</td>
                    <td className="px-5 py-3 text-muted-foreground">{a.usuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AppShell>
  );
}
