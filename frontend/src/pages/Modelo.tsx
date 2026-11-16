import { useEffect, useState } from "react";
import CameraView, { type CapturedShot } from "../components/CameraView";
import { api, apiError } from "../api";
import { showToast } from "../lib/toast";
import type { CapturePoint, ModelVersion, Estimate } from "../types";

export default function Modelo() {
  const [status, setStatus] = useState<{ active: ModelVersion | null; versions: ModelVersion[] }>({ active: null, versions: [] });
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<CapturedShot[]>([]);
  const [points, setPoints] = useState<CapturePoint[]>([]);
  const [capturePointId, setCapturePointId] = useState("");
  const [breed, setBreed] = useState("");
  const [sex, setSex] = useState("");
  const [category, setCategory] = useState("");
  const [ageMonths, setAgeMonths] = useState("");
  const [bcs, setBcs] = useState("");
  const [estimating, setEstimating] = useState(false);

  useEffect(() => {
    api.modelStatus()
      .then((s) => {
        setStatus((prev) => ({ ...prev, active: s.active }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
    api.modelVersions().then((v) => setStatus((prev) => ({ ...prev, versions: v }))).catch(() => undefined);
    api.listCapturePoints().then((p) => {
      setPoints(p);
      if (p.length > 0) setCapturePointId((current) => current || p[0].id);
    }).catch(() => undefined);
  }, []);

  if (loading) return <div style={{ padding: 32, textAlign: "center" }}>Carregando…</div>;

  const active = status.active;
  const versions = status.versions;

  const handleEstimateCapture = async (shot: CapturedShot) => {
    if (!capturePointId) {
      showToast("Selecione o ponto de captura antes de estimar.", "warning");
      return;
    }
    setEstimating(true);
    try {
      const res = await api.estimate({
        file: shot.blob,
        capturePointId,
        breed: breed || undefined,
        sex: sex || undefined,
        category: category || undefined,
        ageMonths: ageMonths ? Number(ageMonths) : undefined,
        bcs: bcs ? Number(bcs) : undefined,
      });
      setEstimate(res);
      showToast(`Estimado: ${res.weight_kg.toFixed(1)} kg ± ${res.interval_half_width_kg.toFixed(1)} kg`, "success");
    } catch (e) {
      showToast(apiError(e), "error");
    } finally {
      setEstimating(false);
    }
  };

  const MIN_EST = 1;
  const MAX_EST = 1;

  return (
    <div>
      <h2 style={{ fontSize: "1.2rem" }}>Modelo & Estimativa</h2>

      <div className="card">
        <div className="card-title">Status do modelo</div>
        {active ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="badge badge-ok">Ativo: {active.version}</span>
              <span className="badge badge-warn">{active.algorithm.toUpperCase()}</span>
              <span className="badge">Animais: {active.n_animals}</span>
              <span className="badge">Fotos: {active.n_photos}</span>
            </div>
            {active.metrics.mae_kg && (
              <ul style={{ fontSize: "0.85rem", marginTop: 8 }}>
                <li>MAE: {active.metrics.mae_kg.toFixed(1)} kg</li>
                <li>MAPE: {active.metrics.mape_pct?.toFixed(1)}%</li>
                <li>Bias: {active.metrics.bias_kg?.toFixed(1)} kg</li>
                <li>Faixa de incerteza: ±{active.metrics.interval_half_width_kg} kg</li>
              </ul>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 8, color: "var(--text-muted)" }}>
            Nenhum modelo treinado ainda. Colete ao menos {status.versions.length ? "dados" : "dados"} suficientes
            e use o Painel para treinar.
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Histórico de versões</div>
        {versions.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Sem versões.</p>
        ) : (
          <ul style={{ marginTop: 8 }}>
            {versions.map((v) => (
              <li key={v.id} style={{ fontSize: "0.8rem", marginBottom: 4, display: "flex", gap: 8, alignItems: "center" }}>
                <span className={`badge ${v.active ? "badge-ok" : "badge-warn"}`}>{v.version}</span>
                <span>{v.algorithm} · {v.n_animals} animais · {v.metrics.mae_kg?.toFixed(1) || "?"} kg MAE</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {active && (
        <div className="card">
          <div className="card-title">Estimar peso de uma foto</div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 6 }}>
            Tire ou envie uma foto do animal no ponto de captura padrão. O modelo devolve o peso ± faixa.
          </p>

          <select value={capturePointId} onChange={(e) => setCapturePointId(e.target.value)} style={{ marginTop: 8, marginBottom: 8 }}>
            <option value="">Selecione o ponto de captura…</option>
            {points.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.distance_cm} cm / {p.camera_height_cm} cm
              </option>
            ))}
          </select>

          <div className="form-row two" style={{ marginTop: 8 }}>
            <label>
              Raça (opcional)
              <input value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Nelore" />
            </label>
            <label>
              Sexo (opcional)
              <select value={sex} onChange={(e) => setSex(e.target.value)}>
                <option value="">—</option>
                <option value="macho">Macho</option>
                <option value="femea">Fêmea</option>
              </select>
            </label>
            <label>
              Categoria (opcional)
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">—</option>
                <option value="bezerro">Bezerro</option>
                <option value="novilha">Novilha</option>
                <option value="vaca">Vaca</option>
                <option value="boi">Boi</option>
              </select>
            </label>
            <label>
              Idade (meses)
              <input type="number" min={0} value={ageMonths} onChange={(e) => setAgeMonths(e.target.value)} />
            </label>
            <label>
              BCS (1–9)
              <input type="number" min={1} max={9} step={0.5} value={bcs} onChange={(e) => setBcs(e.target.value)} />
            </label>
          </div>

          <CameraView
            minPhotos={MIN_EST}
            maxPhotos={MAX_EST}
            photos={photos}
            onCapture={(shot) => {
              setPhotos([shot]);
              handleEstimateCapture(shot);
            }}
            onRemovePhoto={(id) => setPhotos((prev) => prev.filter((p) => p.id !== id))}
          />
          {estimating && <p style={{ textAlign: "center" }}>Calculando peso…</p>}

          {estimate && (
            <div className="card" style={{ marginTop: 16, background: "#e8f5e9", textAlign: "center" }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--primary)" }}>
                {estimate.weight_kg.toFixed(1)} kg
              </div>
              <div style={{ fontSize: "1rem", marginTop: 4 }}>
                ± {estimate.interval_half_width_kg.toFixed(1)} kg
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  &nbsp;({estimate.weight_min_kg.toFixed(1)} – {estimate.weight_max_kg.toFixed(1)} kg)
                </span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 8 }}>
                Modelo: {estimate.model_version} · MAE esperado: {estimate.expected_mae_kg?.toFixed(1) ?? "?"} kg
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}