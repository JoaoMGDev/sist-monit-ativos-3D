/**
 * Camada de dados do MVP (modelo relacional em memória):
 * usuarios, salas, patrimonio, status_logs.
 *
 * O serviço de tempo real simula um canal WebSocket assíncrono: um emissor
 * publica eventos de status e a UI/motor 3D reagem por assinatura (sem refresh).
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
  ): Patrimonio => ({ id: uid(), codigo, nome, tipo, ip, salaId, x, z, status, atualizadoEm: now });

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

let patrimonios: Patrimonio[] = seedAssets();
let logs: StatusLog[] = [];

type Listener = () => void;
const listeners = new Set<Listener>();
let snapshotAssets = patrimonios;
let snapshotLogs = logs;
let snapshotSalas = salas;

function emit() {
  snapshotAssets = [...patrimonios];
  snapshotLogs = [...logs];
  snapshotSalas = [...salas];
  listeners.forEach((l) => l());
}

/** Alinhamento à grade de 1m — os ativos ficam centralizados na célula. */
export const snapToGrid = (v: number) => Math.floor(v) + 0.5;

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
    emit();
  },
  removeSala(id: string) {
    salas = salas.filter((s) => s.id !== id);
    patrimonios = patrimonios.filter((p) => p.salaId !== id);
    emit();
  },
  add(input: Omit<Patrimonio, "id" | "atualizadoEm" | "status">) {
    patrimonios = [...patrimonios, { ...input, id: uid(), status: "online", atualizadoEm: Date.now() }];
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
  /** Realocação espacial: persiste sala + coordenadas imediatamente. */
  relocate(id: string, salaId: string, x: number, z: number) {
    store.update(id, { salaId, x, z });
  },
  setStatus(id: string, status: Status) {
    const asset = patrimonios.find((p) => p.id === id);
    if (!asset || asset.status === status) return;
    store.update(id, { status });
    logs = [
      { id: `l${logs.length + 1}`, patrimonioId: id, codigo: asset.codigo, status, criadoEm: Date.now() },
      ...logs,
    ].slice(0, 100);
    emit();
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

/** Validações */
export const onlyDigits = (v: string) => v.replace(/\D/g, "");

export function maskIp(value: string) {
  const digits = value.replace(/[^\d]/g, "").slice(0, 12);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 3) parts.push(digits.slice(i, i + 3));
  return parts
    .map((p) => (Number(p) > 255 ? "255" : p))
    .join(".")
    .slice(0, 15);
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
