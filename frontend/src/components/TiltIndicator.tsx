interface TiltIndicatorProps {
  tiltDeg: number | null;
  beta: number | null;
  gamma: number | null;
  maxTilt: number;
}

/** Nível de bolha: mostra inclinação e bloqueia o disparo acima da tolerância. */
export default function TiltIndicator({ tiltDeg, beta, gamma, maxTilt }: TiltIndicatorProps) {
  if (tiltDeg === null) {
    return (
      <div className="card small muted" style={{ padding: 10, marginBottom: 8 }}>
        Nível do celular indisponível neste aparelho. Confira o tripé no olho; a foto não será bloqueada.
      </div>
    );
  }

  const ok = tiltDeg <= maxTilt;
  const near = tiltDeg <= maxTilt * 0.6;
  const color = near ? "var(--success)" : ok ? "var(--warning)" : "var(--danger)";
  const bubbleX = Math.max(-42, Math.min(42, (gamma ?? 0) * 5));
  const bubbleY = Math.max(-42, Math.min(42, (beta ?? 0) * 5));

  return (
    <div className="card" style={{ padding: 10, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Nível do celular</div>
        <div style={{ fontWeight: 700, color, fontSize: "0.9rem" }}>
          {tiltDeg.toFixed(1)}° {ok ? "✓ ok" : "✗ torto"}
        </div>
      </div>
      <div
        style={{
          position: "relative",
          height: 44,
          marginTop: 6,
          borderRadius: 8,
          background: "#e8f5e9",
          border: "1px solid var(--border)",
          overflow: "hidden",
        }}
        role="img"
        aria-label={`Nível de bolha: inclinação ${tiltDeg.toFixed(1)} graus, limite ${maxTilt} graus`}
      >
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "60%", height: 2, background: "var(--border)" }} />
        </div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: color,
            border: "2px solid #fff",
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
            transform: `translate(calc(-50% + ${bubbleX}px), calc(-50% + ${bubbleY}px))`,
            transition: "transform 0.08s linear",
          }}
        />
      </div>
      <div className="small muted" style={{ marginTop: 4 }}>
        Limite: {maxTilt}°. {ok ? "Nivelado, pode fotografar." : "Endireite o tripé antes de fotografar."}
      </div>
    </div>
  );
}