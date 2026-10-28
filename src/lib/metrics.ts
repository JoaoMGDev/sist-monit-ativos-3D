import { useEffect, useState } from "react";
import { store } from "./asset-store";
import { settings } from "./settings";

export interface MetricSample {
  t: number;
  online: number;
  offline: number;
}

const MAX_POINTS = 720;

export const FAIXAS = [
  { valor: 30 * 60 * 1000, label: "30 min" },
  { valor: 60 * 60 * 1000, label: "1 hora" },
  { valor: 24 * 60 * 60 * 1000, label: "24 horas" },
] as const;

let samples: MetricSample[] = [];
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let intervaloAtual = 0;

function collect(): MetricSample {
  const list = store.getAssets();
  const offline = list.filter((a) => a.status === "offline").length;
  return { t: Date.now(), online: list.length - offline, offline };
}

function tick() {
  samples = [...samples, collect()].slice(-MAX_POINTS);
  listeners.forEach((l) => l());
}

function start() {
  const desejado = settings.get().graficoIntervalo;
  if (timer && intervaloAtual === desejado) return;
  if (timer) clearInterval(timer);
  intervaloAtual = desejado;
  if (samples.length === 0) samples = [collect()];
  timer = setInterval(tick, desejado);
}

/** Séries filtradas pela faixa de tempo escolhida no dashboard. */
export function useMetrics(faixaMs?: number) {
  const [data, setData] = useState<MetricSample[]>(samples);
  useEffect(() => {
    start();
    const l = () => setData(samples);
    listeners.add(l);
    const offSettings = settings.subscribe(() => start());
    if (samples.length === 0) tick();
    else setData(samples);
    return () => {
      listeners.delete(l);
      offSettings();
    };
  }, []);
  if (!faixaMs) return data;
  const corte = Date.now() - faixaMs;
  const filtrado = data.filter((s) => s.t >= corte);
  return filtrado.length ? filtrado : data.slice(-1);
}

export const formatClock = (t: number) =>
  new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
