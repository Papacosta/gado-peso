export const DEFAULT_CHECKLIST = [
  "Animal parado",
  "Animal de lado (perfil)",
  "Animal inteiro no quadro",
  "Terreno plano",
  "Ninguém na frente da câmera",
];

interface ChecklistProps {
  items?: string[];
  checked: boolean[];
  onChange: (index: number, value: boolean) => void;
}

export default function Checklist({ items = DEFAULT_CHECKLIST, checked, onChange }: ChecklistProps) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="card-title" style={{ fontSize: "0.95rem", marginBottom: 8 }}>
        Checklist antes da foto
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {items.map((item, i) => (
          <label
            key={item}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 6px",
              borderRadius: 8,
              background: checked[i] ? "#e8f5e9" : "#fafafa",
              minHeight: 44,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={(e) => onChange(i, e.target.checked)}
              style={{ width: 26, height: 26, accentColor: "var(--primary)" }}
            />
            <span style={{ fontSize: "0.9rem" }}>{item}</span>
          </label>
        ))}
      </div>
    </div>
  );
}