import { useEffect, useState } from "react";
import CameraView, { type CapturedShot } from "../components/CameraView";
import { api } from "../api";
import { cacheGet, cacheSet, enqueue, localSettings, syncQueue } from "../lib/queue";
import { nowIso, uuid } from "../lib/format";
import { showToast } from "../lib/toast";
import { setUnsavedWork } from "../lib/navGuard";
import PageHeader from "../components/PageHeader";
import type { Animal, CapturePoint } from "../types";

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 5;
/** Faixa plausível de peso vivo de bovinos (evita erro de digitação, ex.: 4120). */
const MIN_WEIGHT = 20;
const MAX_WEIGHT = 1500;

export default function NovaColeta() {
  const [step, setStep] = useState<1 | 2>(1);
  const [points, setPoints] = useState<CapturePoint[]>(() => cacheGet<CapturePoint[]>("capturePoints", []));
  const [animals, setAnimals] = useState<Animal[]>(() => cacheGet<Animal[]>("animals", []));
  const [capturePointId, setCapturePointId] = useState<string>(localSettings.capturePointId ?? "");
  const [animalId, setAnimalId] = useState<string>("");
  const [weight, setWeight] = useState("");
  const [light, setLight] = useState("sol");
  const [timeOfDay, setTimeOfDay] = useState("manha");
  const [fasting, setFasting] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<CapturedShot[]>([]);
  const [saving, setSaving] = useState(false);
  const [triedNext, setTriedNext] = useState(false);

  useEffect(() => {
    api.listCapturePoints().then((list) => { setPoints(list); cacheSet("capturePoints", list); }).catch(() => undefined);
    api.listAnimals().then((list) => { setAnimals(list); cacheSet("animals", list); }).catch(() => undefined);
  }, []);

  const selectedPoint = points.find((p) => p.id === capturePointId) ?? null;
  const selectedAnimal = animals.find((a) => a.id === animalId) ?? null;
  const weightNum = Number(weight.replace(",", "."));
  const weightError = !weight
    ? "Informe o peso da balança."
    : !Number.isFinite(weightNum) || weightNum < MIN_WEIGHT || weightNum > MAX_WEIGHT
      ? `O peso deve ficar entre ${MIN_WEIGHT} e ${MAX_WEIGHT} kg. Confira se não sobrou ou faltou um dígito.`
      : null;
  const missing = [
    !selectedPoint && "ponto de captura",
    !selectedAnimal && "animal",
    weightError && "peso válido",
  ].filter(Boolean) as string[];
  const step1Valid = missing.length === 0;

  // Fotos tiradas e ainda não salvas: avisa antes de sair da tela.
  useEffect(() => {
    setUnsavedWork(photos.length > 0 ? `Há ${photos.length} foto(s) desta coleta que ainda não foram salvas.` : null);
    return () => setUnsavedWork(null);
  }, [photos.length]);

  async function handleSave() {
    if (!selectedPoint || !selectedAnimal || photos.length < MIN_PHOTOS) return;
    setSaving(true);
    try {
      const weighingId = uuid();
      const createdAt = Date.now();
      const capturedAt = nowIso();

      await enqueue({
        kind: "weighing",
        id: weighingId,
        createdAt,
        payload: {
          id: weighingId,
          animal_id: selectedAnimal.id,
          capture_point_id: selectedPoint.id,
          weight_kg: weightNum,
          weighed_at: capturedAt,
          light_condition: light,
          time_of_day: timeOfDay,
          fasting,
          notes: notes || null,
        },
      });

      for (let i = 0; i < photos.length; i++) {
        const shot = photos[i];
        await enqueue({
          kind: "photo",
          id: shot.id,
          createdAt: createdAt + i + 1,
          weighingId,
          blob: shot.blob,
          capturedAt,
          sensors: shot.sensors,
          width: shot.width,
          height: shot.height,
        });
      }

      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPhotos([]);
      setUnsavedWork(null);

      showToast("Coleta salva no celular. Enviando ao servidor…", "success");
      const result = await syncQueue();
      if (result.pending === 0) {
        showToast("Coleta enviada ao servidor.", "success");
      } else if (result.errors.length) {
        showToast("Coleta salva no celular. Será enviada quando houver internet.", "info");
      }
      window.location.hash = "/painel";
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setSaving(false);
    }
  }

  const steps = (
    <ol className="steps" aria-label="Etapas da coleta">
      <li aria-current={step === 1 ? "step" : undefined}>1. Dados da pesagem</li>
      <li aria-current={step === 2 ? "step" : undefined}>2. Fotos</li>
    </ol>
  );

  if (step === 1) {
    return (
      <div>
        <PageHeader
          title="Coletar com balança"
          description="Registre o peso real da balança e tire de 3 a 5 fotos de lado. É com essas coletas que o app aprende a estimar o peso."
        />
        {steps}

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setTriedNext(true);
            if (step1Valid) {
              setStep(2);
              return;
            }
            // Leva o foco ao primeiro campo com problema.
            const first = !selectedPoint ? "ponto" : !selectedAnimal ? "animal" : "peso";
            document.getElementById(first)?.focus();
          }}
        >
          <p className="form-note">
            Campos com <span className="req">*</span> são obrigatórios.
          </p>

          <div className="card">
            <div className="field">
              <label htmlFor="ponto" className="field-label">
                Ponto de captura <span className="req">*</span>
              </label>
              {points.length === 0 ? (
                <p className="small" style={{ margin: 0 }}>
                  Nenhum ponto cadastrado. <a href="#/pontos">Cadastre o ponto fixo da câmera</a> primeiro.
                </p>
              ) : (
                <select
                  id="ponto"
                  required
                  value={capturePointId}
                  onChange={(e) => setCapturePointId(e.target.value)}
                  aria-invalid={triedNext && !selectedPoint}
                >
                  <option value="">Selecione o ponto…</option>
                  {points.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.distance_cm} cm de distância, {p.camera_height_cm} cm de altura
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="card">
            <div className="field">
              <label htmlFor="animal" className="field-label">
                Animal <span className="req">*</span>
              </label>
              {animals.length === 0 ? (
                <p className="small" style={{ margin: 0 }}>
                  Nenhum animal cadastrado. <a href="#/animais">Cadastre o animal</a> primeiro.
                </p>
              ) : (
                <select
                  id="animal"
                  required
                  value={animalId}
                  onChange={(e) => setAnimalId(e.target.value)}
                  aria-invalid={triedNext && !selectedAnimal}
                >
                  <option value="">Selecione pelo brinco…</option>
                  {animals.map((a) => (
                    <option key={a.id} value={a.id}>
                      Brinco {a.ear_tag}
                      {a.breed ? ` — ${a.breed}` : ""}
                      {a.category ? ` (${a.category})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <fieldset className="card" style={{ border: 0, margin: "0 0 12px" }}>
            <legend className="card-title" style={{ float: "left", width: "100%", marginBottom: 8 }}>
              Pesagem na balança
            </legend>
            <div className="form-row" style={{ clear: "both" }}>
              <div className="field">
                <label htmlFor="peso" className="field-label">
                  Peso (kg) <span className="req">*</span>
                </label>
                <input
                  id="peso"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  required
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="Ex.: 412"
                  aria-invalid={triedNext && Boolean(weightError)}
                  aria-describedby="peso-ajuda peso-erro"
                />
                <span id="peso-ajuda" className="field-hint">
                  Peso mostrado na balança, entre {MIN_WEIGHT} e {MAX_WEIGHT} kg.
                </span>
                {triedNext && weightError && (
                  <span id="peso-erro" className="field-error">
                    {weightError}
                  </span>
                )}
              </div>
              <div className="form-row two">
                <div className="field">
                  <label htmlFor="luz" className="field-label">Luz</label>
                  <select id="luz" value={light} onChange={(e) => setLight(e.target.value)}>
                    <option value="sol">Sol pleno</option>
                    <option value="sombra">Sombra</option>
                    <option value="nebuloso">Nublado</option>
                    <option value="artificial">Luz artificial</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="horario" className="field-label">Horário</label>
                  <select id="horario" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)}>
                    <option value="manha">Manhã</option>
                    <option value="tarde">Tarde</option>
                    <option value="noite">Noite</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="jejum" className="field-label">O animal estava em jejum?</label>
                <select
                  id="jejum"
                  value={fasting === null ? "" : String(fasting)}
                  onChange={(e) => setFasting(e.target.value === "" ? null : e.target.value === "true")}
                >
                  <option value="">Não sei / não informado</option>
                  <option value="true">Sim</option>
                  <option value="false">Não</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="obs" className="field-label">Observações</label>
                <textarea
                  id="obs"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex.: animal agitado, sombra parcial…"
                />
              </div>
            </div>
          </fieldset>

          {triedNext && !step1Valid && (
            <div className="alert alert-error" role="alert">
              <strong>Falta preencher:</strong> {missing.join(", ")}.
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-block btn-lg">
            Continuar para as fotos →
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Coletar com balança"
        action={
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStep(1)}>
            ← Voltar aos dados
          </button>
        }
      />
      {steps}

      <div className="card small">
        <strong>Brinco {selectedAnimal?.ear_tag}</strong> · {selectedAnimal?.breed ?? "raça não informada"} ·{" "}
        {weightNum.toLocaleString("pt-BR")} kg
        <div className="muted">
          {selectedPoint?.name}: câmera a {selectedPoint?.distance_cm} cm de distância e {selectedPoint?.camera_height_cm} cm
          de altura
        </div>
      </div>

      <CameraView
        minPhotos={MIN_PHOTOS}
        maxPhotos={MAX_PHOTOS}
        photos={photos}
        onCapture={(shot) => setPhotos((prev) => [...prev, shot])}
        onRemovePhoto={(id) => setPhotos((prev) => prev.filter((p) => p.id !== id))}
      />

      <button
        type="button"
        className="btn btn-primary btn-block btn-lg"
        style={{ marginTop: 12 }}
        disabled={photos.length < MIN_PHOTOS || saving}
        onClick={handleSave}
        aria-describedby="salvar-ajuda"
      >
        {saving ? "Salvando…" : `Salvar coleta (${photos.length} de ${MIN_PHOTOS}–${MAX_PHOTOS} fotos)`}
      </button>
      <p id="salvar-ajuda" className="small muted" style={{ textAlign: "center" }}>
        {photos.length < MIN_PHOTOS
          ? `Tire mais ${MIN_PHOTOS - photos.length} foto(s) para poder salvar.`
          : "A coleta fica salva no celular e é enviada quando houver internet."}
      </p>
    </div>
  );
}
