import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAssets, useSalas } from "@/hooks/use-assets";
import { FAIXAS, formatClock, useMetrics } from "@/lib/metrics";
import { INTERVALOS, useSettings } from "@/lib/settings";

const PALETTE = ["#1f3b6e", "#3f6bb5", "#7ba0dd", "#b7c9ea", "#9aa7bd", "#5a6b86"];

export function AnalyticsCharts() {
  const [faixa, setFaixa] = useState<number>(FAIXAS[0].valor);
  const metrics = useMetrics(faixa);
  const assets = useAssets();
  const salas = useSalas();
  const cfg = useSettings();

  const intervaloLabel =
    INTERVALOS.find((i) => i.valor === cfg.graficoIntervalo)?.label ?? `${cfg.graficoIntervalo / 1000}s`;

  const timeline = useMemo(
    () => metrics.map((m) => ({ hora: formatClock(m.t), Online: m.online, Offline: m.offline })),
    [metrics],
  );

  const porSala = useMemo(
    () =>
      salas
        .map((s) => ({ name: s.nome, value: assets.filter((a) => a.salaId === s.id).length }))
        .filter((d) => d.value > 0),
    [salas, assets],
  );

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <section
        id="chart-timeline"
        className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Linha do tempo · Online vs Offline</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Amostragem automática da malha de rede a cada {intervaloLabel}.
            </p>
          </div>
          <div className="flex rounded-md border border-border p-0.5 text-xs">
            {FAIXAS.map((f) => (
              <button
                key={f.valor}
                onClick={() => setFaixa(f.valor)}
                className={`rounded-[5px] px-2.5 py-1 transition-colors ${
                  faixa === f.valor ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="gOn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cfg.corOnline} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={cfg.corOnline} stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="gOff" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cfg.corOffline} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={cfg.corOffline} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="hora" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="Online"
                stroke={cfg.corOnline}
                fill="url(#gOn)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="Offline"
                stroke={cfg.corOffline}
                fill="url(#gOff)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section
        id="chart-donut"
        className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
      >
        <h2 className="text-sm font-semibold">Distribuição por ambiente</h2>
        <p className="mt-1 text-xs text-muted-foreground">Total de equipamentos por sala mapeada.</p>
        <div className="mt-4 h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={porSala} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2}>
                {porSala.map((d, i) => (
                  <Cell key={d.name} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
