import type { SensorSnapshot } from "../types";

interface SensorChipsProps {
  snapshot: SensorSnapshot | null;
}

const LABELS: Array<{ key: keyof SensorSnapshot; label: string }> = [
  { key: "orientation", label: "Nível" },
  { key: "motion", label: "Movimento" },
  { key: "camera", label: "Câmera" },
  { key: "geolocation", label: "GPS" },
  { key: "ambient_light", label: "Luz" },
  { key: "depth", label: "Profundidade" },
];

/** Mostra quais sensores estão disponíveis (nunca bloqueia a captura). */
export default function SensorChips({ snapshot }: SensorChipsProps) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
      {LABELS.map(({ key, label }) => {
        const section = snapshot?.[key] as { available?: boolean } | undefined;
        const available = Boolean(section?.available);
        return (
          <span
            key={key}
            className={`badge ${available ? "badge-ok" : "badge-warn"}`}
            title={available ? `${label} disponível` : `${label} indisponível neste aparelho`}
          >
            <span aria-hidden="true">{available ? "●" : "○"}</span> {label}
            <span className="sr-only">{available ? " disponível" : " indisponível"}</span>
          </span>
        );
      })}
    </div>
  );
}