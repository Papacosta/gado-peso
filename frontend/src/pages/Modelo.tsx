import { useEffect, useState } from "react";
import CameraView, { type CapturedShot } from "../components/CameraView";
import { api, apiError } from "../api";
import { showToast } from "../lib/toast";
import type { CapturePoint, ModelVersion, Estimate } from "../types";
import PageHeader from "../components/PageHeader";

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

  if (loading) {
    return (
      <div>
        <PageHeader title="Modelo e estimativa" />
        <p className="card" role="status">Carregando…</p>
      </div>
    );
  }

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
      <PageHeader title="Modelo e estimativa" description="Teste o modelo com uma foto e veja as versões treinadas." />
      <p className="small">
        <a href="#/painel">← Voltar ao painel</a>
      </p>

      <section className="card" aria-labelledby="md-status">
        <h2 id="md-status" className="card-title" style={{ marginTop: 0 }}>Modelo em uso</h2>
        {active ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="badge badge-ok">Versão {active.version}</span>
              <span className="badge badge-neutral">{active.n_animals} animais</span>
              <span className="badge badge-neutral">{active.n_photos} fotos</span>
            </div>
            {active.metrics.mae_kg != null && (
              <p className="small" style={{ marginBottom: 0 }}>
                Erro médio de <strong>{active.metrics.mae_kg.toFixed(1)} kg</strong> (
                {active.metrics.mape_pct?.toFixed(1)}% do peso). As estimativas mostram margem de ±
                {active.metrics.interval_half_width_kg} kg.
              </p>
            )}
          </div>
        ) : (
          <p className="small muted" style={{ marginBottom: 0 }}>
            Nenhum modelo treinado ainda. Faça coletas com balança e treine o modelo no{" "}
            <a href="#/painel">Painel</a>.
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="md-hist">
        <h2 id="md-hist" className="card-title" style={{ marginTop: 0 }}>Versões treinadas</h2>
        {versions.length === 0 ? (
          <p className="small muted">Nenhuma versão ainda.</p>
        ) : (
          <ul className="list">
            {versions.map((v) => (
              <li key={v.id} className="small">
                <span>
                  <strong>Versão {v.version}</strong> · {v.n_animals} animais · erro médio{" "}
                  {v.metrics.mae_kg != null ? `${v.metrics.mae_kg.toFixed(1)} kg` : "não calculado"}
                </span>
                <span className={`badge ${v.active ? "badge-ok" : "badge-neutral"}`}>{v.active ? "em uso" : v.algorithm}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {active && (
        <section className="card" aria-labelledby="md-estimar">
          <h2 id="md-estimar" className="card-title" style={{ marginTop: 0 }}>Estimar o peso de uma foto</h2>
          <p className="small muted" style={{ marginTop: 6 }}>
            Fotografe o animal de lado, no ponto de captura. Os dados abaixo são opcionais, mas melhoram a estimativa.
          </p>

          <div className="form-row">
            <div className="field">
              <label htmlFor="md-ponto" className="field-label">
                Ponto de captura <span className="req">*</span>
              </label>
              <select id="md-ponto" required value={capturePointId} onChange={(e) => setCapturePointId(e.target.value)}>
                <option value="">Selecione o ponto…</option>
                {points.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.distance_cm} cm / {p.camera_height_cm} cm
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row two">
              <div className="field">
                <label htmlFor="md-raca" className="field-label">Raça</label>
                <input id="md-raca" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Nelore" />
              </div>
              <div className="field">
                <label htmlFor="md-sexo" className="field-label">Sexo</label>
                <select id="md-sexo" value={sex} onChange={(e) => setSex(e.target.value)}>
                  <option value="">Não informado</option>
                  <option value="macho">Macho</option>
                  <option value="femea">Fêmea</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="md-cat" className="field-label">Categoria</label>
                <select id="md-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Não informada</option>
                  <option value="bezerro">Bezerro</option>
                  <option value="novilha">Novilha</option>
                  <option value="vaca">Vaca</option>
                  <option value="boi">Boi</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="md-idade" className="field-label">Idade (meses)</label>
                <input id="md-idade" type="number" inputMode="numeric" min={0} value={ageMonths} onChange={(e) => setAgeMonths(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="md-escore" className="field-label">Escore de condição corporal (1 a 9)</label>
              <input id="md-escore" type="number" inputMode="decimal" min={1} max={9} step={0.5} value={bcs} onChange={(e) => setBcs(e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
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
          </div>
          <div aria-live="polite">
            {estimating && <p className="card" style={{ textAlign: "center" }}>Calculando o peso…</p>}
            {estimate && (
              <div className="card" style={{ marginTop: 16, background: "#e8f5e9", textAlign: "center" }}>
                <div className="small muted">Peso estimado</div>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--primary-dark)" }}>
                  {estimate.weight_kg.toFixed(0)} kg
                </div>
                <div>
                  entre {estimate.weight_min_kg.toFixed(0)} e {estimate.weight_max_kg.toFixed(0)} kg (± {estimate.interval_half_width_kg.toFixed(0)} kg)
                </div>
                <div className="small muted" style={{ marginTop: 8 }}>
                  Modelo versão {estimate.model_version} · erro médio {estimate.expected_mae_kg?.toFixed(1) ?? "?"} kg
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
