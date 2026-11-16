import { useEffect, useState } from "react";
import { api, apiError } from "../api";
import { cacheGet, cacheSet, enqueue, localSettings } from "../lib/queue";
import { nowIso, uuid } from "../lib/format";
import { showToast } from "../lib/toast";
import type { CapturePoint } from "../types";

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

  async function handleSave() {
    if (!form.name.trim() || !form.distance_cm || !form.camera_height_cm) {
      showToast("Preencha nome, distância e altura da câmera.", "warning");
      return;
    }
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
      setForm({ ...EMPTY });
      setShowForm(false);
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
      setForm({ ...EMPTY });
      setShowForm(false);
      showToast(`Sem conexão: ponto salvo na fila local (${message}).`, "warning");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Pontos de captura</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Fechar" : "+ Novo"}
        </button>
      </div>

      <div className="card" style={{ borderLeft: "4px solid var(--warning)", fontSize: "0.85rem" }}>
        <strong>Atenção:</strong> a câmera deve ficar sempre no mesmo ponto. Trocar a distância ou a
        altura invalida a comparação entre fotos de pontos diferentes.
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">Novo ponto de captura</div>
          <div className="form-row" style={{ marginTop: 8 }}>
            <label>
              Nome do ponto *
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Mangueiro A — tripé 1" />
            </label>
            <label>
              Celular usado
              <input value={form.device_model} onChange={(e) => setForm({ ...form, device_model: e.target.value })} placeholder="Ex.: Galaxy A54" />
            </label>
            <div className="form-row two">
              <label>
                Distância câmera–animal (cm) *
                <input type="number" min={0} value={form.distance_cm} onChange={(e) => setForm({ ...form, distance_cm: e.target.value })} />
              </label>
              <label>
                Altura da câmera (cm) *
                <input type="number" min={0} value={form.camera_height_cm} onChange={(e) => setForm({ ...form, camera_height_cm: e.target.value })} />
              </label>
            </div>
            <label>
              Observações
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : "Salvar ponto"}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {points.map((p) => (
          <div key={p.id} className="card" style={{ padding: 12, marginBottom: 0, border: selected === p.id ? "2px solid var(--primary)" : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong>{p.name}</strong>
              {selected === p.id ? (
                <span className="badge badge-ok">Padrão</span>
              ) : (
                <button
                  className="btn btn-secondary"
                  style={{ minHeight: 36, padding: "6px 12px", fontSize: "0.8rem" }}
                  onClick={() => {
                    localSettings.capturePointId = p.id;
                    setSelected(p.id);
                    showToast("Ponto padrão atualizado.", "success");
                  }}
                >
                  Usar
                </button>
              )}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 6 }}>
              📏 {p.distance_cm} cm de distância · 📱 {p.camera_height_cm} cm de altura
              {p.device_model ? ` · ${p.device_model}` : ""}
            </div>
          </div>
        ))}
        {points.length === 0 && (
          <div className="card" style={{ textAlign: "center", color: "var(--text-muted)" }}>
            Cadastre o ponto onde o celular fica fixo no tripé.
          </div>
        )}
      </div>
    </div>
  );
}