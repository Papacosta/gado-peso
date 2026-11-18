import { useEffect, useState } from "react";
import { api, apiError } from "../api";
import { cacheGet, cacheSet, enqueue, localSettings } from "../lib/queue";
import { nowIso, uuid } from "../lib/format";
import { showToast } from "../lib/toast";
import type { CapturePoint } from "../types";
import PageHeader from "../components/PageHeader";

const EMPTY = {
  name: "",
  device_model: "",
  distance_cm: "",
  camera_height_cm: "",
  notes: "",
};

export default function Pontos() {
  const [points, setPoints] = useState<CapturePoint[]>(() => cacheGet<CapturePoint[]>("capturePoints", []));
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [tried, setTried] = useState(false);
  const [selected, setSelected] = useState<string | null>(localSettings.capturePointId);

  useEffect(() => {
    api.listCapturePoints()
      .then((list) => {
        const cached = cacheGet<CapturePoint[]>("capturePoints", []);
        const merged = [...list, ...cached.filter((c) => !list.some((p) => p.id === c.id))];
        setPoints(merged);
        cacheSet("capturePoints", merged);
      })
      .catch(() => {
        /* offline */
      });
  }, []);

  const errors = {
    name: !form.name.trim() ? "Dê um nome ao ponto." : null,
    distance:
      !form.distance_cm
        ? "Informe a distância."
        : Number(form.distance_cm) < 50 || Number(form.distance_cm) > 3000
          ? "Use um valor entre 50 e 3000 cm."
          : null,
    height:
      !form.camera_height_cm
        ? "Informe a altura."
        : Number(form.camera_height_cm) < 10 || Number(form.camera_height_cm) > 400
          ? "Use um valor entre 10 e 400 cm."
          : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  function closeForm() {
    setForm({ ...EMPTY });
    setTried(false);
    setShowForm(false);
  }

  async function handleSave() {
    setTried(true);
    if (hasErrors) return;
    setSaving(true);
    try {
      const created = await api.createCapturePoint({
        name: form.name.trim(),
        device_model: form.device_model || null,
        distance_cm: Number(form.distance_cm),
        camera_height_cm: Number(form.camera_height_cm),
        notes: form.notes || null,
      });
      const next = [created, ...points.filter((p) => p.id !== created.id)];
      setPoints(next);
      cacheSet("capturePoints", next);
      if (!selected) {
        localSettings.capturePointId = created.id;
        setSelected(created.id);
      }
      closeForm();
      showToast("Ponto de captura salvo.", "success");
    } catch (err) {
      const message = apiError(err);
      const id = uuid();
      const local: CapturePoint = {
        id,
        name: form.name.trim(),
        device_model: form.device_model || null,
        distance_cm: Number(form.distance_cm),
        camera_height_cm: Number(form.camera_height_cm),
        notes: form.notes || null,
        created_at: nowIso(),
      };
      await enqueue({
        kind: "capturePoint",
        id,
        createdAt: Date.now(),
        payload: { ...local },
      });
      const next = [local, ...points];
      setPoints(next);
      cacheSet("capturePoints", next);
      if (!selected) {
        localSettings.capturePointId = id;
        setSelected(id);
      }
      closeForm();
      showToast("Sem conexão: ponto salvo no celular e será enviado depois.", "info");
      console.warn(message);
    } finally {
      setSaving(false);
    }
  }

  const field = (
    id: string,
    label: string,
    key: keyof typeof EMPTY,
    opts: { required?: boolean; number?: boolean; placeholder?: string; hint?: string; error?: string | null } = {}
  ) => (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label} {opts.required && <span className="req">*</span>}
      </label>
      <input
        id={id}
        type={opts.number ? "number" : "text"}
        inputMode={opts.number ? "numeric" : undefined}
        min={opts.number ? 0 : undefined}
        required={opts.required}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={opts.placeholder}
        aria-invalid={tried && Boolean(opts.error)}
        aria-describedby={`${id}-ajuda ${id}-erro`}
      />
      {opts.hint && <span id={`${id}-ajuda`} className="field-hint">{opts.hint}</span>}
      {tried && opts.error && <span id={`${id}-erro`} className="field-error">{opts.error}</span>}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Pontos de captura"
        description="O lugar fixo onde o celular fica no tripé. As fotos só são comparáveis se forem do mesmo ponto."
        action={
          !showForm && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
              + Cadastrar
            </button>
          )
        }
      />
      <p className="small">
        <a href="#/ajustes">← Voltar para Ajustes</a>
      </p>

      <div className="alert alert-warn">
        <strong>Importante</strong>
        Não mude a distância nem a altura do celular depois de cadastrar. Se mudar, cadastre um ponto novo.
      </div>

      {showForm && (
        <form
          className="card"
          noValidate
          aria-labelledby="novo-ponto"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <h2 id="novo-ponto" className="card-title" style={{ marginTop: 0 }}>
            Novo ponto de captura
          </h2>
          <p className="form-note">
            Campos com <span className="req">*</span> são obrigatórios.
          </p>
          <div className="form-row">
            {field("nome", "Nome do ponto", "name", { required: true, placeholder: "Ex.: Mangueiro A — tripé 1", error: errors.name })}
            {field("celular", "Celular usado", "device_model", { placeholder: "Ex.: Galaxy A54" })}
            <div className="form-row two">
              {field("distancia", "Distância até o animal (cm)", "distance_cm", {
                required: true,
                number: true,
                hint: "Da lente até o meio do animal.",
                error: errors.distance,
              })}
              {field("altura", "Altura do celular (cm)", "camera_height_cm", {
                required: true,
                number: true,
                hint: "Do chão até a lente.",
                error: errors.height,
              })}
            </div>
            <div className="field">
              <label htmlFor="obs-ponto" className="field-label">Observações</label>
              <textarea id="obs-ponto" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn-secondary" onClick={closeForm}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Salvando…" : "Salvar ponto"}
              </button>
            </div>
          </div>
        </form>
      )}

      <ul style={{ display: "grid", gap: 8, listStyle: "none", padding: 0, margin: 0 }} aria-label="Pontos cadastrados">
        {points.map((p) => (
          <li
            key={p.id}
            className="card"
            style={{ padding: 12, marginBottom: 0, border: selected === p.id ? "2px solid var(--primary)" : undefined }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong>{p.name}</strong>
              {selected === p.id ? (
                <span className="badge badge-ok">✓ Ponto padrão</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  aria-label={`Usar ${p.name} como ponto padrão`}
                  onClick={() => {
                    localSettings.capturePointId = p.id;
                    setSelected(p.id);
                    showToast(`${p.name} agora é o ponto padrão.`, "success");
                  }}
                >
                  Usar como padrão
                </button>
              )}
            </div>
            <div className="small muted" style={{ marginTop: 6 }}>
              {p.distance_cm} cm de distância · {p.camera_height_cm} cm de altura
              {p.device_model ? ` · ${p.device_model}` : ""}
            </div>
          </li>
        ))}
      </ul>
      {points.length === 0 && (
        <div className="card muted" style={{ textAlign: "center" }}>
          Nenhum ponto ainda. Cadastre o lugar onde o celular fica fixo no tripé.
        </div>
      )}
    </div>
  );
}
