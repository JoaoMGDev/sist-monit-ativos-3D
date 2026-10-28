import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  Hammer,
  Info,
  Lock,
  MoveRight,
  Pencil,
  Plus,
  RotateCcw,
  RotateCw,
  Ruler,
  Trash2,
  Save,
  Undo2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { IsometricRoom, type IsometricRoomHandle } from "@/components/IsometricRoom";
import { FloorPlan2D } from "@/components/FloorPlan2D";
import { useAssets, useSalas } from "@/hooks/use-assets";
import { SalaFormDialog } from "@/components/SalaFormDialog";
import { store, maskIp, onlyDigits, isValidIp, findFreeCell, type AssetKind } from "@/lib/asset-store";
import { history, useCanUndo } from "@/lib/history";
import { useMinhasPermissoes } from "@/lib/permissions";
import { focusBus } from "@/lib/focus-bus";
import { downloadCsv, printReport, type ReportInput } from "@/lib/report";
import { useSettings } from "@/lib/settings";
import { session, useRole, useEditMode } from "@/lib/session";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


export const Route = createFileRoute("/_authenticated/salas/$salaId")({
  head: () => ({
    meta: [
      { title: "Visão Micro 3D · AtivosTI" },
      {
        name: "description",
        content:
          "Planta isométrica 3D da sala com posicionamento dos ativos, status de rede em tempo real e realocação por arrastar e soltar.",
      },
      { property: "og:title", content: "Visão Micro 3D · AtivosTI" },
      {
        property: "og:description",
        content: "Mapa isométrico de ativos de TI por sala com monitoramento em tempo real.",
      },
    ],
  }),
  component: MicroView,
});

const TIPOS: AssetKind[] = ["desktop", "notebook", "servidor", "switch", "impressora"];

function menuPos(x: number, y: number) {
  return {
    x: Math.max(8, Math.min(x, window.innerWidth - 228)),
    y: Math.max(8, Math.min(y, window.innerHeight - 168)),
  };
}

function MicroView() {
  const { salaId } = Route.useParams();
  const navigate = useNavigate();
  const role = useRole();
  const isAdmin = role === "admin";
  const editMode = useEditMode();
  const perms = useMinhasPermissoes();
  const canMove = perms.mover && editMode;
  const canEditInfo = perms.editar;
  const canDelete = perms.excluir;
  const canTransfer = perms.transferir;
  const canMutate = perms.mover || perms.editar || perms.excluir || perms.transferir;
  const assets = useAssets();
  const salas = useSalas();
  const cfg = useSettings();
  const canUndo = useCanUndo();
  const salaEncontrada = salas.find((s) => s.id === salaId) ?? salas[0];
  const sala = salaEncontrada ?? {
    id: "_vazia",
    nome: "",
    numero: "",
    andar: "",
    catalogo: "Térreo" as const,
    largura: 8,
    profundidade: 8,
  };

  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ codigo: "", nome: "", ip: "", tipo: "desktop" as AssetKind });
  const controlsRef = useRef<IsometricRoomHandle | null>(null);
  const [ctxMenu, setCtxMenu] = useState<
    | { kind: "asset"; id: string; x: number; y: number }
    | { kind: "empty"; cx: number; cz: number; x: number; y: number }
    | null
  >(null);
  const [pos, setPos] = useState<{ x: number; z: number } | null>(null);
  const [moveAssetId, setMoveAssetId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [editAssetId, setEditAssetId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", ip: "" });
  /** Marca alterações espaciais ainda não consolidadas (habilita o botão Salvar). */
  const [dirty, setDirty] = useState(false);

  const roomAssets = useMemo(
    () => assets.filter((a) => a.salaId === sala.id),
    [assets, sala.id],
  );
  const selected = assets.find((a) => a.id === selectedId) ?? null;
  const offline = roomAssets.filter((a) => a.status === "offline").length;

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [ctxMenu]);

  const handleRelocate = useCallback(
    (id: string, x: number, z: number) => {
      const before = store.getAssets().find((p) => p.id === id);
      if (!before) return;
      if (before.salaId === sala.id && Math.abs(before.x - x) < 0.01 && Math.abs(before.z - z) < 0.01) return;
      const occupied = store
        .getAssets()
        .some((a) => a.id !== id && a.salaId === sala.id && Math.abs(a.x - x) < 0.5 && Math.abs(a.z - z) < 0.5);
      if (occupied) {
        toast("Posição ocupada", { description: "Já existe um equipamento nesta célula da grade." });
        return;
      }
      store.relocate(id, sala.id, x, z);
      setDirty(true);
      const { salaId: oldSala, x: ox, z: oz } = before;
      history.record(
        "move",
        `Ativo ${before.codigo} movido para ${sala.nome} (${x.toFixed(1)}m, ${z.toFixed(1)}m)`,
        () => store.relocate(id, oldSala, ox, oz),
      );
      toast("Realocação salva", {
        description: `${before.codigo} alinhado à grade em ${sala.nome} (${x.toFixed(1)}m, ${z.toFixed(1)}m).`,
      });
    },
    [sala.id, sala.nome],
  );

  const salvarLayout = useCallback(() => {
    setDirty(false);
    history.clearUndo();
    toast("Alterações salvas", {
      description: `O mapeamento de ${sala.nome} foi consolidado. O histórico de ações foi mantido.`,
    });
  }, [sala.nome]);

  const undo = useCallback(() => {
    const label = history.undo();
    if (!label) {
      toast("Nada para desfazer.");
      return;
    }
    toast("Ação desfeita", { description: label });
  }, []);

  useEffect(
    () =>
      focusBus.subscribe((id) => {
        const alvo = store.getAssets().find((a) => a.id === id);
        if (!alvo || alvo.salaId !== sala.id) return false;
        setSelectedId(id);
        setFocusId(id);
        setTimeout(() => setFocusId(null), 120);
        return true;
      }),
    [sala.id],
  );

  useEffect(() => {
    setDirty(false);
    setSelectedId(null);
    setCtxMenu(null);
    setPos(null);
  }, [sala.id]);

  useEffect(() => {
    if (!salaEncontrada || salaEncontrada.id === salaId) return;
    void navigate({ to: "/salas/$salaId", params: { salaId: salaEncontrada.id }, replace: true });
  }, [salaEncontrada, salaId, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target;
      if (alvo instanceof HTMLElement) {
        const tag = alvo.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || alvo.isContentEditable) return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  const handleBlocked = useCallback(() => {
    toast("Posição ocupada", {
      description: "Já existe um equipamento nesta célula da grade.",
    });
  }, []);

  const handleContextMenu = useCallback((id: string, x: number, y: number) => {
    const p = menuPos(x, y);
    setCtxMenu({ kind: "asset", id, x: p.x, y: p.y });
  }, []);

  const handleContextEmpty = useCallback((cx: number, cz: number, x: number, y: number) => {
    const p = menuPos(x, y);
    setCtxMenu({ kind: "empty", cx, cz, x: p.x, y: p.y });
  }, []);

  const openCreateAt = (cx: number, cz: number) => {
    setPos({ x: cx, z: cz });
    setCtxMenu(null);
    setOpen(true);
  };

  const openMove = (id: string) => {
    const a = store.getAssets().find((p) => p.id === id);
    if (!a) return;
    setMoveTarget(salas.find((s) => s.id !== a.salaId)?.id ?? "");
    setMoveAssetId(id);
    setCtxMenu(null);
  };

  const confirmMove = () => {
    if (!moveAssetId || !moveTarget) return;
    const before = store.getAssets().find((p) => p.id === moveAssetId);
    if (!before) return;
    const destino = salas.find((s) => s.id === moveTarget);
    const ocupadas = store.getAssets().filter((a) => a.salaId === moveTarget);
    const lx = Math.floor((destino?.largura ?? 10) / 2);
    const lz = Math.floor((destino?.profundidade ?? 10) / 2);
    let alvo: { x: number; z: number } | null = null;
    outer: for (let z = -lz; z < lz; z++) {
      for (let x = -lx; x < lx; x++) {
        const px = x + 0.5;
        const pz = z + 0.5;
        if (!ocupadas.some((a) => Math.abs(a.x - px) < 0.5 && Math.abs(a.z - pz) < 0.5)) {
          alvo = { x: px, z: pz };
          break outer;
        }
      }
    }
    if (!alvo) {
      toast("Sala sem espaço", { description: `${destino?.nome ?? "O destino"} não tem células livres na grade.` });
      return;
    }
    const id = moveAssetId;
    const { salaId: oldSala, x: ox, z: oz } = before;
    store.relocate(id, moveTarget, alvo.x, alvo.z);
    setDirty(true);
    history.record("move", `Ativo ${before.codigo} transferido para ${destino?.nome ?? "outra sala"}`, () =>
      store.relocate(id, oldSala, ox, oz),
    );
    setMoveAssetId(null);
    setSelectedId(null);
    toast("Ativo transferido", { description: `${before.codigo} agora está em ${destino?.nome}.` });
  };

  const openEdit = (id: string) => {
    const a = store.getAssets().find((p) => p.id === id);
    if (!a) return;
    setEditForm({ nome: a.nome, ip: a.ip });
    setEditAssetId(id);
    setCtxMenu(null);
  };

  const saveEdit = () => {
    if (!editAssetId) return;
    if (!editForm.nome.trim()) {
      toast("Informe o nome do equipamento.");
      return;
    }
    if (!isValidIp(editForm.ip)) {
      toast("Endereço IP inválido.");
      return;
    }
    if (store.isTaken("ip", editForm.ip, editAssetId)) {
      toast("Esse endereço IP já está em uso.");
      return;
    }
    const before = store.getAssets().find((p) => p.id === editAssetId);
    store.update(editAssetId, { nome: editForm.nome, ip: editForm.ip });
    if (before) {
      const id = editAssetId;
      history.record("edit", `Ativo ${before.codigo} editado (nome/IP)`, () =>
        store.update(id, { nome: before.nome, ip: before.ip }),
      );
    }
    setEditAssetId(null);
    toast("Ativo atualizado");
  };




  const submit = () => {
    if (form.codigo.length < 4) {
      toast("Informe um código de patrimônio válido (somente números).");
      return;
    }
    if (!form.nome.trim()) {
      toast("Informe o nome do equipamento.");
      return;
    }
    if (!isValidIp(form.ip)) {
      toast("Endereço IP inválido.");
      return;
    }
    if (store.isTaken("codigo", form.codigo)) {
      toast("Já existe um patrimônio com esse código.");
      return;
    }
    if (store.isTaken("ip", form.ip)) {
      toast("Esse endereço IP já está em uso.");
      return;
    }
    if (pos) {
      const occupied = store
        .getAssets()
        .some((a) => a.salaId === sala.id && Math.abs(a.x - pos.x) < 0.5 && Math.abs(a.z - pos.z) < 0.5);
      if (occupied) {
        toast("Posição ocupada", { description: "Escolha outra célula da grade." });
        return;
      }
    }

    const destino = pos ?? findFreeCell(sala);
    if (!destino) {
      toast("Sala sem espaço", { description: "Não há células livres para um novo ativo." });
      return;
    }
    const idsBefore = new Set(store.getAssets().map((p) => p.id));
    store.add({ ...form, salaId: sala.id, x: destino.x, z: destino.z });
    setDirty(true);
    const novo = store.getAssets().find((p) => !idsBefore.has(p.id));
    if (novo) {
      history.record("add", `Ativo ${novo.codigo} adicionado em ${sala.nome}`, () => store.remove(novo.id));
    }
    setOpen(false);
    setPos(null);
    setForm({ codigo: "", nome: "", ip: "", tipo: "desktop" });
    toast("Ativo cadastrado", { description: `Patrimônio ${form.codigo} adicionado a ${sala.nome}.` });
  };

  const reportInput = (): ReportInput => ({
    titulo: `Relatório da sala ${sala.nome}`,
    subtitulo: `Visão Micro · sala ${sala.numero} · ${sala.catalogo}`,
    usuario: cfg.nome,
    filtros: [
      { label: "Sala", valor: `${sala.nome} (${sala.numero})` },
      { label: "Visualização", valor: mode === "3d" ? "Isométrica 3D" : "Planta 2D" },
    ],
    metricas: [
      { label: "Ativos na sala", valor: roomAssets.length },
      { label: "Conectados", valor: roomAssets.filter((a) => a.status === "online").length },
      { label: "Falhas", valor: roomAssets.filter((a) => a.status === "offline").length },
      { label: "Área", valor: `${sala.largura} × ${sala.profundidade} m` },
    ],
    rows: roomAssets,
    salas,
    chartIds: [],
  });

  const exportCsv = () => {
    downloadCsv(reportInput(), `ativos-${sala.nome.toLowerCase().replace(/\s+/g, "-")}.csv`);
    toast("Relatório CSV exportado");
  };

  const exportPdf = () => {
    if (!printReport(reportInput())) toast("Permita pop-ups para gerar o PDF.");
  };

  if (!salaEncontrada) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Nenhum ambiente cadastrado.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão Micro · {sala.nome}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sala.andar} · {roomAssets.length} ativos ·{" "}
            {offline ? `${offline} em falha` : "todos operacionais"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={sala.id} onValueChange={(v) => navigate({ to: "/salas/$salaId", params: { salaId: v } })}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {salas.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex rounded-md border border-border p-0.5 text-sm">
            {(["3d", "2d"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-[5px] px-3 py-1.5 transition-colors ${
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {m === "3d" ? "Isométrico 3D" : "Planta 2D"}
              </button>
            ))}
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

          {canEditInfo && (
            <Dialog
              open={open}
              onOpenChange={(o) => {
                setOpen(o);
                if (!o) setPos(null);
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Novo ativo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    Cadastrar patrimônio em {sala.nome}
                    {pos && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        posição {pos.x.toFixed(1)}m · {pos.z.toFixed(1)}m
                      </span>
                    )}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <Label>Código de patrimônio</Label>
                    <Input
                      inputMode="numeric"
                      value={form.codigo}
                      onChange={(e) => setForm({ ...form, codigo: onlyDigits(e.target.value).slice(0, 10) })}
                      placeholder="100246"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Equipamento</Label>
                    <Input
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      placeholder="Estação Financeiro 03"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as AssetKind })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS.map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Endereço IP</Label>
                    <Input
                      value={form.ip}
                      onChange={(e) => setForm({ ...form, ip: maskIp(e.target.value) })}
                      placeholder="10.0.2.24"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={submit}>Cadastrar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-soft)]">
          <header className="border-b border-border px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Use a busca no topo da aplicação para localizar um patrimônio.
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {mode === "3d" && (
                  <div className="flex rounded-md border border-border p-0.5">
                    <button
                      aria-label="Girar câmera à esquerda"
                      onClick={() => controlsRef.current?.rotate(-1)}
                      className="rounded-[5px] p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                      aria-label="Girar câmera à direita"
                      onClick={() => controlsRef.current?.rotate(1)}
                      className="rounded-[5px] p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <RotateCw className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {canMutate && (
                  <>
                    <Button
                      variant="outline"
                      className="h-9 bg-card"
                      disabled={!canUndo}
                      onClick={undo}
                      title="Desfazer última ação (Ctrl+Z)"
                    >
                      <Undo2 className="mr-2 h-4 w-4" /> Desfazer
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9 bg-card"
                      disabled={!dirty}
                      onClick={salvarLayout}
                      title={dirty ? "Salvar alterações do mapeamento" : "Nenhuma alteração pendente"}
                    >
                      <Save className="mr-2 h-4 w-4" /> Salvar
                    </Button>
                  </>
                )}
                {perms.mover && (
                  <Button
                    variant={editMode ? "default" : "outline"}
                    className={`h-9 ${editMode ? "shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]" : ""}`}
                    onClick={() => session.toggleEditMode()}
                  >
                    <Hammer className="mr-2 h-4 w-4" />
                    {editMode ? "Modo Edição ativo" : "Modo Edição"}
                  </Button>
                )}
                {isAdmin && (
                  <SalaFormDialog
                    sala={sala}
                    trigger={
                      <Button variant="outline" className="h-9 bg-card">
                        <Ruler className="mr-2 h-4 w-4" /> Editar ambiente
                      </Button>
                    }
                  />
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        aria-label="Ajuda sobre os controles do mapa"
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Câmera isométrica travada em passos de 90º · pan com arraste e zoom com scroll ·
                      botão direito sobre um ativo abre ações rápidas.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {canMove
                ? "Modo Edição ativo — arraste os ativos para realocar na grade (células ocupadas são bloqueadas)."
                : perms.mover
                  ? "Ative o Modo Edição para mover os ativos no mapa."
                  : canMutate
                    ? "Seu perfil pode alterar dados dos ativos, sem reposicioná-los no mapa."
                    : "Navegação somente leitura."}
            </p>
          </header>
          <div className="h-[560px] w-full bg-surface-3d">
            {mode === "3d" ? (
              <IsometricRoom
                sala={sala}
                assets={roomAssets}
                focusId={focusId}
                selectedId={selectedId}
                canDrag={canMove}
                onSelect={setSelectedId}
                onRelocate={handleRelocate}
                onBlocked={handleBlocked}
                onContextMenu={canEditInfo || canTransfer || canDelete ? handleContextMenu : undefined}
                onContextEmpty={canEditInfo ? handleContextEmpty : undefined}
                controlsRef={controlsRef}
              />
            ) : (
              <FloorPlan2D
                sala={sala}
                assets={roomAssets}
                selectedId={selectedId}
                canDrag={canMove}
                onSelect={setSelectedId}
                onRelocate={handleRelocate}
              />
            )}
          </div>


        </section>

        <aside className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-sm font-semibold">Detalhes do ativo</h2>
            {!selected && (
              <p className="mt-3 text-sm text-muted-foreground">
                Selecione um equipamento no mapa para ver as informações.
              </p>
            )}
            {selected && (
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  ["Patrimônio", selected.codigo],
                  ["Equipamento", selected.nome],
                  ["Tipo", selected.tipo],
                  ["IP", selected.ip],
                  ["Posição", `${selected.x.toFixed(1)}m, ${selected.z.toFixed(1)}m`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium capitalize">{v}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        selected.status === "offline"
                          ? "bg-status-offline-soft text-status-offline"
                          : "bg-status-online-soft text-status-online"
                      }`}
                    >
                      {selected.status === "offline" ? "Offline" : "Online"}
                    </span>
                  </dd>
                </div>
                {canDelete ? (
                  <Button
                    variant="outline"
                    className="mt-2 w-full text-destructive"
                    onClick={() => {
                      const a = selected;
                      store.remove(a.id);
                      setDirty(true);
                      history.record("delete", `Ativo ${a.codigo} excluído de ${sala.nome}`, () =>
                        store.add({
                          codigo: a.codigo,
                          nome: a.nome,
                          tipo: a.tipo,
                          ip: a.ip,
                          salaId: a.salaId,
                          x: a.x,
                          z: a.z,
                          status: a.status,
                        }),
                      );
                      setSelectedId(null);
                      toast("Ativo removido", { description: `Patrimônio ${selected.codigo} excluído.` });
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Remover ativo
                  </Button>
                ) : (
                  <p className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" /> Sem permissão para excluir este ativo.
                  </p>
                )}
              </dl>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card shadow-[var(--shadow-soft)]">
            <header className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">Ativos da sala</h2>
            </header>
            <ul className="max-h-[320px] divide-y divide-border overflow-auto">
              {roomAssets.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => {
                      setSelectedId(a.id);
                      setFocusId(a.id);
                      setTimeout(() => setFocusId(null), 100);
                    }}
                    className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-accent ${
                      selectedId === a.id ? "bg-accent" : ""
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        a.status === "offline" ? "bg-status-offline" : "bg-status-online"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{a.nome}</span>
                      <span className="block text-xs tabular-nums text-muted-foreground">
                        {a.codigo} · {a.ip}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {ctxMenu && (
        <div
          className="fixed z-50 min-w-52 overflow-hidden rounded-md border border-border bg-popover py-1 shadow-md"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxMenu.kind === "empty" ? (
            <>
              <p className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                Célula {ctxMenu.cx.toFixed(1)}m · {ctxMenu.cz.toFixed(1)}m
              </p>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => openCreateAt(ctxMenu.cx, ctxMenu.cz)}
              >
                <Plus className="h-3.5 w-3.5" /> Criar novo ativo aqui
              </button>
            </>
          ) : (
            <>
              {canEditInfo && (
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => openEdit(ctxMenu.id)}
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </button>
              )}
              {canTransfer && (
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => openMove(ctxMenu.id)}
                >
                  <MoveRight className="h-3.5 w-3.5" /> Transferir para outra sala
                </button>
              )}
              {canDelete && (
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-accent"
                onClick={() => {
                  const id = ctxMenu.id;
                  const a = store.getAssets().find((p) => p.id === id);
                  store.remove(id);
                  setDirty(true);
                  if (a) {
                    history.record("delete", `Ativo ${a.codigo} excluído de ${sala.nome}`, () =>
                      store.add({
                        codigo: a.codigo,
                        nome: a.nome,
                        tipo: a.tipo,
                        ip: a.ip,
                        salaId: a.salaId,
                        x: a.x,
                        z: a.z,
                        status: a.status,
                      }),
                    );
                  }
                  setCtxMenu(null);
                  setSelectedId(null);
                  toast("Ativo removido", { description: `Patrimônio ${a?.codigo} excluído.` });
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </button>
              )}
            </>
          )}
        </div>
      )}

      <Dialog open={!!moveAssetId} onOpenChange={(o) => !o && setMoveAssetId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transferir para outra sala</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Ambiente de destino</Label>
            <Select value={moveTarget} onValueChange={setMoveTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o ambiente" />
              </SelectTrigger>
              <SelectContent>
                {salas
                  .filter((s) => s.id !== sala.id)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome} · sala {s.numero}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O ativo será posicionado na primeira célula livre da grade do ambiente escolhido.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveAssetId(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmMove} disabled={!moveTarget}>
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editAssetId} onOpenChange={(o) => !o && setEditAssetId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar ativo</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Equipamento</Label>
              <Input
                value={editForm.nome}
                onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Endereço IP</Label>
              <Input
                value={editForm.ip}
                onChange={(e) => setEditForm({ ...editForm, ip: maskIp(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAssetId(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

