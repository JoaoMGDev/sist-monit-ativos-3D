import type { AssetKind, Status } from "@/lib/asset-store";

/**
 * Ícone isométrico do equipamento no detalhe do inventário.
 * As faces saem da mesma projeção, para a aresta, a gaveta e o LED
 * coincidirem em vez de parecerem traços soltos.
 */
type V = [number, number, number];

const SCALE = 1.18;

function project(x: number, y: number, z: number): [number, number] {
  return [50 + (x - z) * SCALE, 86 - y * SCALE + (x + z) * SCALE * 0.5];
}

function points(vs: V[]) {
  return vs
    .map(([x, y, z]) => {
      const [X, Y] = project(x, y, z);
      return `${X.toFixed(2)},${Y.toFixed(2)}`;
    })
    .join(" ");
}

function Cuboid({
  x,
  y,
  z,
  w,
  h,
  d,
  front,
  side,
  top,
}: {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  front: string;
  side: string;
  top: string;
}) {
  const x1 = x + w;
  const y1 = y + h;
  const z1 = z + d;
  return (
    <g>
      <polygon points={points([[x1, y, z], [x1, y, z1], [x1, y1, z1], [x1, y1, z]])} fill={side} />
      <polygon points={points([[x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]])} fill={front} />
      <polygon points={points([[x, y1, z], [x1, y1, z], [x1, y1, z1], [x, y1, z1]])} fill={top} />
    </g>
  );
}

function Led({ x, y, z, cor }: { x: number; y: number; z: number; cor: string }) {
  const [cx, cy] = project(x, y, z);
  return <circle cx={cx} cy={cy} r="1.7" fill={cor} stroke="none" />;
}

export function AssetGlyph({
  tipo,
  status,
  size = 96,
  showBase = true,
}: {
  tipo: AssetKind;
  status: Status;
  size?: number;
  showBase?: boolean;
}) {
  const cor = status === "offline" ? "var(--status-offline)" : "var(--status-online)";
  const front = "var(--color-card)";
  const side = "color-mix(in srgb, var(--color-foreground) 10%, var(--color-card))";
  const top = "color-mix(in srgb, var(--color-foreground) 5%, var(--color-muted))";
  const slot = "color-mix(in srgb, var(--color-foreground) 16%, var(--color-card))";
  const edge = "color-mix(in srgb, var(--color-foreground) 28%, var(--color-border))";

  const box = { front, side, top };

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${tipo} ${status}`}>
      {showBase && <ellipse cx="50" cy="84" rx="30" ry="7" fill="var(--color-foreground)" opacity="0.08" />}
      <g stroke={edge} strokeWidth="1.15" strokeLinejoin="round" strokeLinecap="round">
        {tipo === "servidor" && (
          <>
            <Cuboid x={-11} y={2} z={-7} w={22} h={46} d={14} {...box} />
            {[0, 1, 2, 3, 4].map((i) => (
              <polygon
                key={i}
                points={points([
                  [-8, 8 + i * 8, 7.15],
                  [6, 8 + i * 8, 7.15],
                  [6, 12.2 + i * 8, 7.15],
                  [-8, 12.2 + i * 8, 7.15],
                ])}
                fill={slot}
              />
            ))}
            {[0, 1, 2, 3, 4].map((i) => (
              <Led key={i} x={8.2} y={10.1 + i * 8} z={7.4} cor={cor} />
            ))}
          </>
        )}

        {tipo === "switch" && (
          <>
            <Cuboid x={-20} y={4} z={-8} w={40} h={10} d={16} {...box} />
            {Array.from({ length: 8 }, (_, i) => (
              <polygon
                key={i}
                points={points([
                  [-16 + i * 4.2, 6.2, 8.2],
                  [-13.4 + i * 4.2, 6.2, 8.2],
                  [-13.4 + i * 4.2, 11.2, 8.2],
                  [-16 + i * 4.2, 11.2, 8.2],
                ])}
                fill={slot}
              />
            ))}
            <Led x={16.4} y={9} z={8.4} cor={cor} />
          </>
        )}

        {tipo === "notebook" && (
          <>
            <Cuboid x={-16} y={0} z={-10} w={32} h={4.5} d={22} {...box} />
            <polygon
              points={points([
                [-11, 4.6, -2],
                [11, 4.6, -2],
                [11, 4.6, 8],
                [-11, 4.6, 8],
              ])}
              fill={slot}
            />
            <polygon
              points={points([
                [-16, 4.5, -10],
                [16, 4.5, -10],
                [16, 28, -18],
                [-16, 28, -18],
              ])}
              fill={side}
            />
            <polygon
              points={points([
                [-13, 8, -12.2],
                [13, 8, -12.2],
                [13, 25.5, -18.6],
                [-13, 25.5, -18.6],
              ])}
              fill={cor}
              opacity="0.9"
            />
            <Led x={12} y={2.4} z={11.2} cor={cor} />
          </>
        )}

        {tipo === "impressora" && (
          <>
            <Cuboid x={-16} y={0} z={-10} w={32} h={16} d={20} {...box} />
            <Cuboid x={-10} y={16} z={-8} w={20} h={7} d={12} front={side} side={side} top={top} />
            <polygon
              points={points([
                [-12, 16.1, -4],
                [12, 16.1, -4],
                [12, 16.1, 6],
                [-12, 16.1, 6],
              ])}
              fill="color-mix(in srgb, white 70%, var(--color-card))"
            />
            <polygon
              points={points([
                [-12, 6, 10.2],
                [8, 6, 10.2],
                [8, 9, 10.2],
                [-12, 9, 10.2],
              ])}
              fill={slot}
            />
            <Led x={11} y={11} z={10.4} cor={cor} />
          </>
        )}

        {tipo === "desktop" && (
          <>
            <Cuboid x={-18} y={0} z={-6} w={9} h={22} d={12} {...box} />
            <Led x={-13.4} y={5.5} z={6.3} cor={cor} />
            <Cuboid x={-5} y={8} z={-4} w={22} h={18} d={2.4} {...box} />
            <polygon
              points={points([
                [-2.2, 11.2, -1.5],
                [14.2, 11.2, -1.5],
                [14.2, 23.2, -1.5],
                [-2.2, 23.2, -1.5],
              ])}
              fill={cor}
              opacity="0.9"
            />
            <polygon
              points={points([
                [4.2, 3, -3.2],
                [7.2, 3, -3.2],
                [7.2, 8, -2.8],
                [4.2, 8, -2.8],
              ])}
              fill={side}
            />
            <Cuboid x={-3} y={0} z={3} w={18} h={1.6} d={8} front={slot} side={side} top={top} />
          </>
        )}
      </g>
    </svg>
  );
}
