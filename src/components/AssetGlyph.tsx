import type { AssetKind, Status } from "@/lib/asset-store";

/**
 * Ilustração isométrica estática (SVG) usada na planta 2D e no modal de detalhes.
 * Desenhada com as mesmas proporções low-poly dos modelos 3D.
 */
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
  const corpo = "var(--color-card)";
  const linha = "var(--color-primary)";

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${tipo} ${status}`}>
      {showBase && (
        <polygon points="50,20 92,44 50,68 8,44" fill="var(--color-muted)" stroke="var(--color-border)" strokeWidth="1" />
      )}
      <g stroke={linha} strokeWidth="1.4" strokeLinejoin="round">
        {tipo === "servidor" && (
          <>
            <polygon points="50,14 76,29 76,63 50,78 24,63 24,29" fill={corpo} />
            <polygon points="50,14 76,29 50,44 24,29" fill={cor} opacity="0.5" />
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <line x1="28" y1={40 + i * 9} x2="48" y2={52 + i * 9} />
                <circle cx="70" cy={41 + i * 9} r="2.2" fill={cor} stroke="none" />
              </g>
            ))}
          </>
        )}

        {tipo === "switch" && (
          <>
            <polygon points="50,34 84,52 50,70 16,52" fill={corpo} />
            <polygon points="16,52 50,70 50,78 16,60" fill={cor} opacity="0.55" />
            <polygon points="50,70 84,52 84,60 50,78" fill={corpo} />
            {[0, 1, 2, 3].map((i) => (
              <circle key={i} cx={38 + i * 9} cy={58 + i * 0} r="1.8" fill={cor} stroke="none" />
            ))}
          </>
        )}

        {tipo === "notebook" && (
          <>
            <polygon points="50,52 82,70 50,88 18,70" fill={corpo} />
            <polygon points="30,60 58,44 82,58 54,74" fill={cor} opacity="0.5" />
            <polygon points="30,60 32,36 60,22 58,44" fill={corpo} />
          </>
        )}

        {tipo === "impressora" && (
          <>
            <polygon points="50,40 82,58 50,76 18,58" fill={corpo} />
            <polygon points="18,58 50,76 50,86 18,68" fill={cor} opacity="0.5" />
            <polygon points="50,76 82,58 82,68 50,86" fill={corpo} />
            <polygon points="38,36 62,36 70,42 46,42" fill={corpo} />
          </>
        )}

        {tipo === "desktop" && (
          <>
            <polygon points="50,46 86,66 50,86 14,66" fill={corpo} />
            <line x1="14" y1="66" x2="14" y2="74" />
            <line x1="86" y1="66" x2="86" y2="74" />
            <polygon points="40,38 56,30 74,40 58,48" fill={cor} opacity="0.5" />
            <polygon points="40,38 40,54 58,64 58,48" fill={corpo} />
            <polygon points="58,48 74,40 74,56 58,64" fill={corpo} />
            <circle cx="66" cy="49" r="2" fill={cor} stroke="none" />
          </>
        )}
      </g>
    </svg>
  );
}
