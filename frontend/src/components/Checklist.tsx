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
  /** Atalho para quem já conferiu tudo de uma vez (usuário experiente). */
  onCheckAll?: () => void;
}

export default function Checklist({ items = DEFAULT_CHECKLIST, checked, onChange, onCheckAll }: ChecklistProps) {
  const done = checked.filter(Boolean).length;
  return (
    <fieldset className="card" style={{ padding: 12, border: 0, margin: "0 0 12px" }}>
      <legend className="card-title" style={{ float: "left", width: "100%", fontSize: "1rem", marginBottom: 8 }}>
        Antes de fotografar, confira ({done} de {items.length})
      </legend>
      <div style={{ display: "grid", gap: 6, clear: "both" }}>
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
              minHeight: 48,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={(e) => onChange(i, e.target.checked)}
              style={{ width: 26, height: 26, accentColor: "var(--primary)", flexShrink: 0 }}
            />
            <span style={{ fontSize: "0.95rem" }}>{item}</span>
          </label>
        ))}
      </div>
      {onCheckAll && done < items.length && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={onCheckAll}>
          Já conferi tudo — marcar todos
        </button>
      )}
    </fieldset>
  );
}
