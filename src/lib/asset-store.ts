/**
 * Camada de dados do MVP: usuarios, salas, patrimonio, status_logs.
 *
 * Salas e patrimônios ficam gravados neste navegador (`localStorage`), então
 * mover um ativo na grade ou transferi-lo de sala sobrevive a atualizar a página.
 * O monitoramento em tempo real continua simulado: um emissor publica eventos
 * de status e a UI reage por assinatura.
 */

import { settings } from "./settings";

export type Role = "admin" | "viewer";
export type AssetKind = "desktop" | "notebook" | "servidor" | "switch" | "impressora";
export type Status = "online" | "offline";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: Role;
}

export const CATALOGOS = [
  "1º Andar",
  "2º Andar",
  "Térreo",
  "Administrativo",
  "Laboratório",
] as const;
export type Catalogo = (typeof CATALOGOS)[number];

export interface Sala {
  id: string;
  nome: string;
  numero: string;
  andar: string;
  catalogo: Catalogo;
  largura: number; // metros (eixo X)
  profundidade: number; // metros (eixo Z)
}

export interface Patrimonio {
  id: string;
  codigo: string; // apenas números
  nome: string;
  tipo: AssetKind;
  ip: string;
  salaId: string;
  x: number; // posição na sala (metros)
  z: number;
  status: Status;
  atualizadoEm: number;
}

export interface StatusLog {
  id: string;
  patrimonioId: string;
  codigo: string;
  status: Status;
  criadoEm: number;
}

export const usuarios: Usuario[] = [
  { id: "u1", nome: "Ana Ribeiro", email: "ana.ribeiro@empresa.com", perfil: "admin" },
  { id: "u2", nome: "Carlos Mendes", email: "carlos.mendes@empresa.com", perfil: "viewer" },
];

let salas: Sala[] = [
  { id: "s1", nome: "Data Center", numero: "001", andar: "Térreo", catalogo: "Térreo", largura: 12, profundidade: 9 },
  { id: "s2", nome: "Administrativo", numero: "101", andar: "1º andar", catalogo: "Administrativo", largura: 14, profundidade: 10 },
  { id: "s3", nome: "Suporte Técnico", numero: "102", andar: "1º andar", catalogo: "1º Andar", largura: 11, profundidade: 8 },
  { id: "s4", nome: "Diretoria", numero: "201", andar: "2º andar", catalogo: "2º Andar", largura: 10, profundidade: 8 },
];

let seq = 0;
const uid = () => `a${++seq}`;

/** Alinhamento à grade de 1m — os ativos ficam centralizados na célula. */
export const snapToGrid = (v: number) => Math.floor(v) + 0.5;

function seedAssets(): Patrimonio[] {
  const now = Date.now();
  const make = (
    codigo: string,
    nome: string,
    tipo: AssetKind,
    ip: string,
    salaId: string,
    x: number,
    z: number,
    status: Status = "online",
  ): Patrimonio => ({
    id: uid(),
    codigo,
    nome,
    tipo,
    ip,
    salaId,
    x: snapToGrid(x),
    z: snapToGrid(z),
    status,
    atualizadoEm: now,
  });

  return [
    make("100241", "Servidor de Aplicação", "servidor", "10.0.1.10", "s1", -3, -2),
    make("100242", "Servidor de Banco", "servidor", "10.0.1.11", "s1", -1, -2),
    make("100243", "Switch Core", "switch", "10.0.1.2", "s1", 1.5, -2),
    make("100244", "Switch Borda A", "switch", "10.0.1.3", "s1", 3.5, -2, "offline"),
    make("100245", "Console de Operação", "desktop", "10.0.1.40", "s1", 0, 2),

    make("200311", "Estação Financeiro 01", "desktop", "10.0.2.21", "s2", -4, -2),
    make("200312", "Estação Financeiro 02", "desktop", "10.0.2.22", "s2", -1.5, -2),
    make("200313", "Estação RH 01", "desktop", "10.0.2.23", "s2", 1, -2),
    make("200314", "Notebook Compras", "notebook", "10.0.2.51", "s2", 3.5, -2),
    make("200315", "Impressora Central", "impressora", "10.0.2.90", "s2", 0, 2.5),

    make("300455", "Bancada Suporte 01", "desktop", "10.0.3.31", "s3", -3, -1.5),
    make("300456", "Bancada Suporte 02", "desktop", "10.0.3.32", "s3", -0.5, -1.5),
    make("300457", "Notebook Field 01", "notebook", "10.0.3.61", "s3", 2, -1.5),
    make("300458", "Switch Suporte", "switch", "10.0.3.4", "s3", 0, 2),

    make("400588", "Notebook Diretoria", "notebook", "10.0.4.71", "s4", -2, -1),
    make("400589", "Estação Secretaria", "desktop", "10.0.4.41", "s4", 1, -1),
    make("400590", "Impressora Diretoria", "impressora", "10.0.4.91", "s4", 0, 2),
  ];
}

const STORAGE_KEY = "ativosti.inventario";
const TIPOS: readonly AssetKind[] = ["desktop", "notebook", "servidor", "switch", "impressora"];

function isSala(value: unknown): value is Sala {
  if (!value || typeof value !== "object") return false;
  const sala = value as Sala;
  return (
    typeof sala.id === "string" &&
    sala.id.length > 0 &&
    typeof sala.nome === "string" &&
    typeof sala.numero === "string" &&
    typeof sala.andar === "string" &&
    (CATALOGOS as readonly string[]).includes(sala.catalogo) &&
    typeof sala.largura === "number" &&
    typeof sala.profundidade === "number"
  );
}

function isPatrimonio(value: unknown): value is Patrimonio {
  if (!value || typeof value !== "object") return false;
  const asset = value as Patrimonio;
  return (
    typeof asset.id === "string" &&
    asset.id.length > 0 &&
    typeof asset.codigo === "string" &&
    typeof asset.nome === "string" &&
    TIPOS.includes(asset.tipo) &&
    typeof asset.ip === "string" &&
    typeof asset.salaId === "string" &&
    typeof asset.x === "number" &&
    typeof asset.z === "number" &&
    (asset.status === "online" || asset.status === "offline") &&
    typeof asset.atualizadoEm === "number"
  );
}

function maiorSeq(list: Patrimonio[], atual: number) {
  let next = atual;
  for (const asset of list) {
    const n = Number(/^a(\d+)$/.exec(asset.id)?.[1]);
    if (Number.isFinite(n) && n > next) next = n;
  }
  return next;
}

/** Restaura o inventário gravado neste navegador. Sem dados válidos, fica a semente. */
function readPersisted(): { seq: number; salas: Sala[]; patrimonios: Patrimonio[] } | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { seq?: unknown; salas?: unknown; patrimonios?: unknown };
    if (!Array.isArray(data.salas) || !Array.isArray(data.patrimonios)) return null;
    const salasOk = data.salas.filter(isSala);
    if (!salasOk.length) return null;
    const ids = new Set(salasOk.map((sala) => sala.id));
    const assetsOk = data.patrimonios.filter(isPatrimonio).filter((asset) => ids.has(asset.salaId));
    const seqSalvo = typeof data.seq === "number" && Number.isFinite(data.seq) ? data.seq : 0;
    return { seq: maiorSeq(assetsOk, seqSalvo), salas: salasOk, patrimonios: assetsOk };
  } catch {
    return null;
  }
}

let patrimonios: Patrimonio[] = seedAssets();
const salvo = readPersisted();
if (salvo) {
  salas = salvo.salas;
  patrimonios = salvo.patrimonios;
  seq = maiorSeq(patrimonios, Math.max(seq, salvo.seq));
}
let logs: StatusLog[] = [];

function persist() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seq, salas, patrimonios }));
  } catch {
    /* cota do navegador estourada: a sessão atual segue em memória */
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();
let snapshotAssets = patrimonios;
let snapshotLogs = logs;
let snapshotSalas = salas;

function emit() {
  snapshotAssets = [...patrimonios];
  snapshotLogs = [...logs];
  snapshotSalas = [...salas];
  persist();
  listeners.forEach((l) => l());
}

export const store = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getAssets: () => snapshotAssets,
  getLogs: () => snapshotLogs,
  getSalas: () => snapshotSalas,
  getSala: (id: string) => salas.find((s) => s.id === id),
  addSala(input: Omit<Sala, "id" | "andar">) {
    const sala: Sala = { ...input, id: `s${salas.length + 1}_${Date.now()}`, andar: input.catalogo };
    salas = [...salas, sala];
    emit();
    return sala;
  },
  updateSala(id: string, patch: Partial<Sala>) {
    salas = salas.map((s) => (s.id === id ? { ...s, ...patch, andar: patch.catalogo ?? s.andar } : s));
    const sala = salas.find((s) => s.id === id);
    if (sala) patrimonios = relayout(sala, patrimonios);
    emit();
  },
  removeSala(id: string) {
    salas = salas.filter((s) => s.id !== id);
    patrimonios = patrimonios.filter((p) => p.salaId !== id);
    emit();
  },
  add(input: Omit<Patrimonio, "id" | "atualizadoEm" | "status"> & { status?: Status }) {
    const sala = salas.find((s) => s.id === input.salaId);
    const cell = sala ? clampToCell(sala, input.x, input.z) : { x: snapToGrid(input.x), z: snapToGrid(input.z) };
    patrimonios = [
      ...patrimonios,
      {
        ...input,
        ...cell,
        id: uid(),
        status: input.status ?? "online",
        atualizadoEm: Date.now(),
      },
    ];
    emit();
  },
  update(id: string, patch: Partial<Patrimonio>) {
    patrimonios = patrimonios.map((p) => (p.id === id ? { ...p, ...patch, atualizadoEm: Date.now() } : p));
    emit();
  },
  remove(id: string) {
    patrimonios = patrimonios.filter((p) => p.id !== id);
    emit();
  },
  /** Realocação espacial: persiste sala + coordenadas imediatamente, já na célula da grade. */
  relocate(id: string, salaId: string, x: number, z: number) {
    const sala = salas.find((s) => s.id === salaId);
    const cell = sala ? clampToCell(sala, x, z) : { x: snapToGrid(x), z: snapToGrid(z) };
    store.update(id, { salaId, x: cell.x, z: cell.z });
  },
  setStatus(id: string, status: Status) {
    const asset = patrimonios.find((p) => p.id === id);
    if (!asset || asset.status === status) return;
    const now = Date.now();
    patrimonios = patrimonios.map((p) => (p.id === id ? { ...p, status, atualizadoEm: now } : p));
    logs = [
      { id: `l${logs.length + 1}`, patrimonioId: id, codigo: asset.codigo, status, criadoEm: now },
      ...logs,
    ].slice(0, 100);
    emit();
  },
  isTaken(field: "codigo" | "ip", value: string, ignoreId?: string) {
    const v = value.trim();
    return patrimonios.some((p) => p.id !== ignoreId && p[field] === v);
  },
};

/** O modo simulação pode ser desligado nas Configurações. */
const simulacaoAtiva = () => settings.get().simulacao;

/** Serviço assíncrono de monitoramento (canal WebSocket simulado). */
type StatusEvent = { asset: Patrimonio; status: Status };
const netListeners = new Set<(e: StatusEvent) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

export function connectMonitoring(onEvent: (e: StatusEvent) => void) {
  netListeners.add(onEvent);
  if (!timer) {
    timer = setInterval(() => {
      if (!simulacaoAtiva()) return;
      const list = store.getAssets();
      if (!list.length) return;
      const target = list[Math.floor(Math.random() * list.length)]!;
      const status: Status = target.status === "online" ? "offline" : "online";
      // falhas são mais raras do que recuperações
      if (status === "offline" && Math.random() > 0.45) return;
      store.setStatus(target.id, status);
      const updated = store.getAssets().find((p) => p.id === target.id)!;
      netListeners.forEach((l) => l({ asset: updated, status }));
    }, 6000);
  }
  return () => {
    netListeners.delete(onEvent);
    if (netListeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Células de 1 m centradas em *.5, dentro do piso da sala. */
export function cellsOf(sala: Pick<Sala, "largura" | "profundidade">) {
  const lx = Math.floor(sala.largura / 2);
  const lz = Math.floor(sala.profundidade / 2);
  const cells: { x: number; z: number }[] = [];
  for (let z = -lz; z < lz; z++) {
    for (let x = -lx; x < lx; x++) cells.push({ x: x + 0.5, z: z + 0.5 });
  }
  return cells;
}

/** Encaixa um ponto na célula da grade mais próxima que ainda cabe na sala. */
export function clampToCell(sala: Pick<Sala, "largura" | "profundidade">, x: number, z: number) {
  const lx = Math.floor(sala.largura / 2);
  const lz = Math.floor(sala.profundidade / 2);
  return {
    x: Math.max(-lx + 0.5, Math.min(lx - 0.5, snapToGrid(x))),
    z: Math.max(-lz + 0.5, Math.min(lz - 0.5, snapToGrid(z))),
  };
}

export function findFreeCell(sala: Sala, ignoreId?: string): { x: number; z: number } | null {
  const used = patrimonios.filter((p) => p.salaId === sala.id && p.id !== ignoreId);
  for (const c of cellsOf(sala)) {
    if (!used.some((a) => Math.abs(a.x - c.x) < 0.5 && Math.abs(a.z - c.z) < 0.5)) return c;
  }
  return null;
}

function cellKey(x: number, z: number) {
  return `${x}:${z}`;
}

/** Recoloca ativos que ficaram fora da sala ou sobrepostos depois de um redimensionamento. */
function relayout(sala: Sala, list: Patrimonio[]) {
  const cells = cellsOf(sala);
  const used = new Set<string>();
  return list.map((p) => {
    if (p.salaId !== sala.id) return p;
    let spot = clampToCell(sala, p.x, p.z);
    const fits = cells.some((c) => c.x === spot.x && c.z === spot.z);
    if (!fits || used.has(cellKey(spot.x, spot.z))) {
      const free = cells.find((c) => !used.has(cellKey(c.x, c.z)));
      if (free) spot = free;
    }
    used.add(cellKey(spot.x, spot.z));
    if (spot.x === p.x && spot.z === p.z) return p;
    return { ...p, x: spot.x, z: spot.z };
  });
}

/** Validações */
export const onlyDigits = (v: string) => v.replace(/\D/g, "");

function octet(digits: string) {
  if (!digits) return "";
  const n = Number(digits.slice(0, 3));
  if (n > 255) return "255";
  return digits.length > 1 ? String(n) : digits;
}

/**
 * Máscara de IPv4 que preserva os pontos digitados.
 * Sem isso, "10.0.1.10" virava "100.110" porque os separadores eram descartados
 * e os dígitos reagrupados de 3 em 3.
 */
export function maskIp(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!cleaned) return "";

  if (!cleaned.includes(".") && cleaned.length > 3) {
    const digits = cleaned.slice(0, 12);
    const grouped: string[] = [];
    for (let i = 0; i < digits.length && grouped.length < 4; i += 3) {
      grouped.push(octet(digits.slice(i, i + 3)));
    }
    return grouped.join(".").slice(0, 15);
  }

  const endsWithDot = cleaned.endsWith(".");
  const parts = cleaned
    .split(".")
    .slice(0, 4)
    .map((part) => octet(part.replace(/\D/g, "")))
    .filter((part, index, all) => part !== "" || (endsWithDot && index === all.length - 1 && all.length > 1));

  const body = parts.filter((part) => part !== "").join(".");
  const result = endsWithDot && parts.filter((part) => part !== "").length < 4 ? `${body}.` : body;
  return result.slice(0, 15);
}

export const isValidIp = (v: string) =>
  /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(v);

export function toCsv(rows: Patrimonio[]) {
  const head = "codigo;nome;tipo;ip;sala;status;atualizado_em";
  const body = rows.map((r) =>
    [
      r.codigo,
      r.nome,
      r.tipo,
      r.ip,
      salas.find((s) => s.id === r.salaId)?.nome ?? "-",
      r.status,
      new Date(r.atualizadoEm).toLocaleString("pt-BR"),
    ].join(";"),
  );
  return [head, ...body].join("\n");
}
