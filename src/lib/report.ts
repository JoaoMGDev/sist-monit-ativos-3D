import type { Patrimonio, Sala } from "./asset-store";

export interface ReportInput {
  titulo: string;
  subtitulo: string;
  usuario: string;
  filtros: { label: string; valor: string }[];
  metricas: { label: string; valor: string | number }[];
  rows: Patrimonio[];
  salas: Sala[];
  chartIds?: string[];
}

const dataHora = () => new Date().toLocaleString("pt-BR");
const salaNome = (salas: Sala[], id: string) => salas.find((s) => s.id === id)?.nome ?? "-";

/** Evita quebra de coluna e fórmula de planilha em campos digitados pelo usuário. */
export function csvField(value: string | number) {
  let s = String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[;"\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function esc(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildCsv(input: ReportInput) {
  const lines: string[] = [];
  lines.push(`# ${input.titulo}`);
  lines.push(`# ${input.subtitulo}`);
  lines.push(`# Gerado em;${csvField(dataHora())};Usuário;${csvField(input.usuario)}`);
  lines.push("#");
  lines.push("# Métricas");
  input.metricas.forEach((m) => lines.push(`# ${csvField(m.label)};${csvField(m.valor)}`));
  lines.push("#");
  lines.push("# Filtros aplicados");
  input.filtros.forEach((f) => lines.push(`# ${csvField(f.label)};${csvField(f.valor)}`));
  lines.push("");
  lines.push("codigo;equipamento;tipo;ip;sala;status;atualizado_em");
  input.rows.forEach((r) =>
    lines.push(
      [
        r.codigo,
        r.nome,
        r.tipo,
        r.ip,
        salaNome(input.salas, r.salaId),
        r.status === "offline" ? "Offline" : "Online",
        new Date(r.atualizadoEm).toLocaleString("pt-BR"),
      ]
        .map(csvField)
        .join(";"),
    ),
  );
  return lines.join("\n");
}

export function downloadCsv(input: ReportInput, filename: string) {
  const blob = new Blob(["\ufeff" + buildCsv(input)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function chartsHtml(ids: string[]) {
  if (typeof document === "undefined") return "";
  const svgs = ids
    .map((id) => document.querySelector(`#${id} svg`)?.outerHTML)
    .filter(Boolean) as string[];
  if (!svgs.length) return "";
  return `<section class="charts">${svgs
    .map((s) => `<div class="chart">${s}</div>`)
    .join("")}</section>`;
}

/** Abre uma janela com layout profissional e dispara a impressão / salvar como PDF. */
export function printReport(input: ReportInput) {
  const win = window.open("", "_blank", "width=1024,height=768");
  if (!win) return false;

  const rows = input.rows
    .map(
      (r) => `<tr>
        <td class="num">${esc(r.codigo)}</td>
        <td>${esc(r.nome)}</td>
        <td class="cap">${esc(r.tipo)}</td>
        <td class="num">${esc(r.ip)}</td>
        <td>${esc(salaNome(input.salas, r.salaId))}</td>
        <td><span class="pill ${r.status}">${r.status === "offline" ? "Offline" : "Online"}</span></td>
      </tr>`,
    )
    .join("");

  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
  <title>${esc(input.titulo)}</title>
  <style>
    *{box-sizing:border-box} body{font-family:Inter,-apple-system,Segoe UI,sans-serif;color:#101828;margin:0;padding:36px;background:#fff}
    header{border-bottom:3px solid #1f3b6e;padding-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end;gap:24px}
    .brand{font-size:20px;font-weight:700;color:#1f3b6e;letter-spacing:-.3px}
    .brand small{display:block;font-size:11px;font-weight:500;color:#667085;letter-spacing:.4px;text-transform:uppercase;margin-top:4px}
    h1{font-size:16px;margin:0}
    .meta{font-size:11px;color:#667085;text-align:right;line-height:1.6}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:22px 0}
    .card{border:1px solid #e4e7ec;border-radius:8px;padding:12px}
    .card span{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#667085}
    .card strong{display:block;font-size:22px;margin-top:6px}
    .filters{font-size:11px;color:#475467;background:#f8fafc;border:1px solid #e4e7ec;border-radius:8px;padding:10px 12px;margin-bottom:20px}
    .filters b{color:#101828}
    .charts{display:grid;grid-template-columns:1.5fr 1fr;gap:16px;margin-bottom:24px}
    .chart{border:1px solid #e4e7ec;border-radius:8px;padding:10px;overflow:hidden}
    .chart svg{width:100%;height:auto}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{text-align:left;background:#f2f4f7;color:#475467;text-transform:uppercase;font-size:9.5px;letter-spacing:.5px;padding:8px}
    td{padding:8px;border-bottom:1px solid #eaecf0}
    .num{font-variant-numeric:tabular-nums}.cap{text-transform:capitalize}
    .pill{padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600}
    .pill.online{background:#e7f4ed;color:#2f6b50}.pill.offline{background:#fbeaea;color:#9c3a3a}
    footer{margin-top:24px;border-top:1px solid #eaecf0;padding-top:10px;font-size:10px;color:#98a2b3;display:flex;justify-content:space-between}
    @page{margin:14mm}
  </style></head><body>
  <header>
    <div class="brand">AtivosTI<small>Gestão de Ativos · Mapeamento 3D</small></div>
    <div>
      <h1>${esc(input.titulo)}</h1>
      <div class="meta">${esc(input.subtitulo)}<br/>Gerado em ${esc(dataHora())}<br/>Responsável: ${esc(input.usuario)}</div>
    </div>
  </header>
  <div class="grid">
    ${input.metricas.map((m) => `<div class="card"><span>${esc(m.label)}</span><strong>${esc(m.valor)}</strong></div>`).join("")}
  </div>
  <div class="filters"><b>Filtros aplicados:</b> ${
    input.filtros.map((f) => `${esc(f.label)}: ${esc(f.valor)}`).join(" &nbsp;·&nbsp; ") || "nenhum"
  }</div>
  ${chartsHtml(input.chartIds ?? [])}
  <table><thead><tr>
    <th>Patrimônio</th><th>Equipamento</th><th>Tipo</th><th>IP</th><th>Sala</th><th>Status</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <footer><span>AtivosTI · relatório gerado automaticamente</span><span>${input.rows.length} registro(s)</span></footer>
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
  return true;
}
