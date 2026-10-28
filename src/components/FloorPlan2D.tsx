import { useRef, useState } from "react";
import { clampToCell, type AssetKind, type Patrimonio, type Sala } from "@/lib/asset-store";

interface Props {
  sala: Sala;
  assets: Patrimonio[];
  selectedId: string | null;
  canDrag: boolean;
  onSelect: (id: string | null) => void;
  onRelocate: (id: string, x: number, z: number) => void;
}

/** Marcação vetorial por tipo — desenhada em coordenadas locais (-0.5..0.5). */
function Marca({ tipo, cor }: { tipo: AssetKind; cor: string }) {
  const traco = { fill: "none", stroke: cor, strokeWidth: 0.055, strokeLinejoin: "round" as const };
  switch (tipo) {
    case "servidor":
      return (
        <g {...traco}>
          <rect x={-0.2} y={-0.32} width={0.4} height={0.64} rx={0.05} />
          <line x1={-0.2} y1={-0.12} x2={0.2} y2={-0.12} />
          <line x1={-0.2} y1={0.08} x2={0.2} y2={0.08} />
          <circle cx={0.1} cy={-0.22} r={0.035} fill={cor} />
        </g>
      );
    case "switch":
      return (
        <g {...traco}>
          <rect x={-0.32} y={-0.14} width={0.64} height={0.28} rx={0.05} />
          {[-0.2, -0.07, 0.06, 0.19].map((x) => (
            <circle key={x} cx={x} cy={0} r={0.035} fill={cor} />
          ))}
        </g>
      );
    case "notebook":
      return (
        <g {...traco}>
          <rect x={-0.3} y={-0.28} width={0.6} height={0.34} rx={0.04} />
          <rect x={-0.34} y={0.08} width={0.68} height={0.14} rx={0.05} />
        </g>
      );
    case "impressora":
      return (
        <g {...traco}>
          <rect x={-0.28} y={-0.08} width={0.56} height={0.32} rx={0.05} />
          <rect x={-0.16} y={-0.28} width={0.32} height={0.18} rx={0.03} />
          <line x1={-0.16} y1={0.1} x2={0.16} y2={0.1} />
        </g>
      );
    default:
      return (
        <g {...traco}>
          <rect x={-0.3} y={-0.3} width={0.42} height={0.3} rx={0.04} />
          <line x1={-0.09} y1={0} x2={-0.09} y2={0.12} />
          <line x1={-0.24} y1={0.12} x2={0.06} y2={0.12} />
          <rect x={0.14} y={-0.26} width={0.16} height={0.42} rx={0.04} />
          <circle cx={0.22} cy={0.08} r={0.03} fill={cor} />
        </g>
      );
  }
}

export function FloorPlan2D({ sala, assets, selectedId, canDrag, onSelect, onRelocate }: Props) {
  const pad = 0.6;
  const w = sala.largura + pad * 2;
  const h = sala.profundidade + pad * 2;
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; z: number } | null>(null);
  const gesture = useRef<{
    id: string;
    x: number;
    z: number;
    startX: number;
    startY: number;
    armed: boolean;
  } | null>(null);

  const toRoom = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const scale = Math.min(r.width / w, r.height / h);
    const offX = (r.width - w * scale) / 2;
    const offY = (r.height - h * scale) / 2;
    const vx = (clientX - r.left - offX) / scale;
    const vy = (clientY - r.top - offY) / scale;
    return { x: vx - pad - sala.largura / 2, z: vy - pad - sala.profundidade / 2 };
  };

  const onPointerDown = (e: React.PointerEvent, a: Patrimonio) => {
    onSelect(a.id);
    if (!canDrag) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = {
      id: a.id,
      x: a.x,
      z: a.z,
      startX: e.clientX,
      startY: e.clientY,
      armed: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    if (!g.armed && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < 5) return;
    g.armed = true;
    const p = toRoom(e.clientX, e.clientY);
    if (!p) return;
    const cell = clampToCell(sala, p.x, p.z);
    g.x = cell.x;
    g.z = cell.z;
    setDrag({ id: g.id, x: cell.x, z: cell.z });
  };

  const endDrag = () => {
    const g = gesture.current;
    gesture.current = null;
    if (g?.armed) {
      const original = assets.find((a) => a.id === g.id);
      const moved = !original || Math.abs(original.x - g.x) > 0.01 || Math.abs(original.z - g.z) > 0.01;
      if (moved) onRelocate(g.id, g.x, g.z);
    }
    setDrag(null);
  };

  return (
    <div className="flex h-full w-full select-none touch-none items-center justify-center bg-[var(--surface-3d)] p-6">
      <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} className="h-full w-full max-w-4xl">
        <defs>
          <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M 1 0 L 0 0 0 1" fill="none" stroke="var(--color-border)" strokeWidth="0.02" />
          </pattern>
        </defs>
        <rect x={pad} y={pad} width={sala.largura} height={sala.profundidade} fill="var(--color-card)" />
        <rect x={pad} y={pad} width={sala.largura} height={sala.profundidade} fill="url(#grid)" />
        <rect
          x={pad}
          y={pad}
          width={sala.largura}
          height={sala.profundidade}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="0.09"
        />
        {canDrag && drag && (
          <rect
            x={pad + sala.largura / 2 + drag.x - 0.5}
            y={pad + sala.profundidade / 2 + drag.z - 0.5}
            width={1}
            height={1}
            fill="var(--color-primary)"
            opacity={0.12}
          />
        )}
        {assets.map((a) => {
          const live = drag?.id === a.id ? drag : a;
          const x = pad + sala.largura / 2 + live.x;
          const y = pad + sala.profundidade / 2 + live.z;
          const active = a.id === selectedId;
          const cor = a.status === "online" ? "var(--status-online)" : "var(--status-offline)";
          return (
            <g
              key={a.id}
              onPointerDown={(e) => onPointerDown(e, a)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className={canDrag ? "cursor-grab" : "cursor-pointer"}
            >
              <rect
                x={x - 0.46}
                y={y - 0.46}
                width={0.92}
                height={0.92}
                rx={0.14}
                fill={cor}
                fillOpacity={0.14}
                stroke={active ? "var(--color-primary)" : cor}
                strokeWidth={active ? 0.09 : 0.04}
              />
              <g transform={`translate(${x} ${y})`}>
                <Marca tipo={a.tipo} cor={cor} />
              </g>
              <text
                x={x}
                y={y + 0.78}
                textAnchor="middle"
                fontSize="0.3"
                fill="var(--color-muted-foreground)"
              >
                {a.codigo}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
