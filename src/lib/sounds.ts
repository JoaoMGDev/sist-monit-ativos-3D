/** Biblioteca de toques curtos para alertas (WebAudio, sem arquivos externos). */

export type ToqueId = "ping" | "bip" | "sino" | "pop" | "alerta";

export const TOQUES: { id: ToqueId; label: string }[] = [
  { id: "ping", label: "Ping suave" },
  { id: "bip", label: "Bip curto" },
  { id: "sino", label: "Sino cristalino" },
  { id: "pop", label: "Pop discreto" },
  { id: "alerta", label: "Alerta duplo" },
];

interface Nota {
  freq: number;
  freqFim?: number;
  inicio: number;
  duracao: number;
  tipo: OscillatorType;
}

const RECEITAS: Record<ToqueId, Nota[]> = {
  ping: [{ freq: 880, freqFim: 1320, inicio: 0, duracao: 0.2, tipo: "sine" }],
  bip: [{ freq: 1046, inicio: 0, duracao: 0.09, tipo: "square" }],
  sino: [
    { freq: 1568, inicio: 0, duracao: 0.5, tipo: "sine" },
    { freq: 2093, inicio: 0.02, duracao: 0.45, tipo: "sine" },
  ],
  pop: [{ freq: 420, freqFim: 180, inicio: 0, duracao: 0.12, tipo: "triangle" }],
  alerta: [
    { freq: 660, inicio: 0, duracao: 0.11, tipo: "sine" },
    { freq: 660, inicio: 0.16, duracao: 0.11, tipo: "sine" },
  ],
};

/** Toca um toque específico com o volume informado (0..1). */
export function tocarToque(toque: ToqueId, volume: number) {
  if (typeof window === "undefined" || volume <= 0) return;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notas = RECEITAS[toque] ?? RECEITAS.ping;
    let fim = 0;
    notas.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0 = ctx.currentTime + n.inicio;
      const t1 = t0 + n.duracao;
      osc.type = n.tipo;
      osc.frequency.setValueAtTime(n.freq, t0);
      if (n.freqFim) osc.frequency.exponentialRampToValueAtTime(n.freqFim, t1);
      const pico = Math.max(0.0002, 0.12 * volume);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(pico, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t1 + 0.02);
      fim = Math.max(fim, n.inicio + n.duracao);
    });
    setTimeout(() => void ctx.close(), (fim + 0.3) * 1000);
  } catch {
    /* áudio indisponível */
  }
}
