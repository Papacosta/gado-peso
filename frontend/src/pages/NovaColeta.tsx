import { useEffect, useState } from "react";
import CameraView, { type CapturedShot } from "../components/CameraView";
import { api } from "../api";
import { cacheGet, cacheSet, enqueue, localSettings, syncQueue } from "../lib/queue";
import { nowIso, uuid } from "../lib/format";
import { showToast } from "../lib/toast";
import type { Animal, CapturePoint } from "../types";

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 5;

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

  useEffect(() => {
    api.listCapturePoints().then((list) => { setPoints(list); cacheSet("capturePoints", list); }).catch(() => undefined);
    api.listAnimals().then((list) => { setAnimals(list); cacheSet("animals", list); }).catch(() => undefined);
  }, []);

  const selectedPoint = points.find((p) => p.id === capturePointId) ?? null;
  const selectedAnimal = animals.find((a) => a.id === animalId) ?? null;
  const step1Valid = Boolean(selectedPoint && selectedAnimal && Number(weight) > 0);

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
          weight_kg: Number(weight),
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

      showToast("Sessão salva na fila local. Sincronizando…", "success");
      const result = await syncQueue();
      if (result.pending === 0) {
        showToast("Sessão enviada para o servidor.", "success");
      } else if (result.errors.length) {
        showToast(`Salvo no celular. ${result.errors[0]}`, "warning");
      }
      window.location.hash = "/painel";
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setSaving(false);
    }
  }

  if (step === 1) {
    return (
      <div>
        <h2 style={{ fontSize: "1.2rem" }}>Nova coleta</h2>
        <div className="card" style={{ fontSize: "0.85rem", background: "#e8f5e9" }}>
          Posicione o animal no ponto marcado, mantenha o celular no tripé e preencha os dados da
          pesagem. Depois o app abre a câmera guiada.
        </div>

        <div className="card">
          <div className="card-title">1. Ponto de captura</div>
          {points.length === 0 ? (
            <p style={{ fontSize: "0.85rem" }}>
              Nenhum ponto cadastrado. <a href="#/pontos">Cadastre o ponto fixo</a> primeiro.
            </p>
          ) : (
            <select value={capturePointId} onChange={(e) => setCapturePointId(e.target.value)} style={{ marginTop: 8 }}>
              <option value="">Selecione o ponto…</option>
              {points.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.distance_cm} cm / {p.camera_height_cm} cm
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="card">
          <div className="card-title">2. Animal</div>
          {animals.length === 0 ? (
            <p style={{ fontSize: "0.85rem" }}>
              Nenhum animal cadastrado. <a href="#/animais">Cadastre o animal</a> primeiro.
            </p>
          ) : (
            <select value={animalId} onChange={(e) => setAnimalId(e.target.value)} style={{ marginTop: 8 }}>
              <option value="">Selecione o animal…</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  #{a.ear_tag} {a.breed ? `— ${a.breed}` : ""} {a.category ? `(${a.category})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="card">
          <div className="card-title">3. Pesagem real (balança)</div>
          <div className="form-row" style={{ marginTop: 8 }}>
            <label>
              Peso (kg) *
              <input type="number" inputMode="decimal" min={1} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Ex.: 412" />
            </label>
            <div className="form-row two">
              <label>
                Luz
                <select value={light} onChange={(e) => setLight(e.target.value)}>
                  <option value="sol">Sol pleno</option>
                  <option value="sombra">Sombra</option>
                  <option value="nebuloso">Nublado</option>
                  <option value="artificial">Artificial</option>
                </select>
              </label>
              <label>
                Horário
                <select value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)}>
                  <option value="manha">Manhã</option>
                  <option value="tarde">Tarde</option>
                  <option value="noite">Noite</option>
                </select>
              </label>
            </div>
            <label>
              Jejum?
              <select value={fasting === null ? "" : String(fasting)} onChange={(e) => setFasting(e.target.value === "" ? null : e.target.value === "true")}>
                <option value="">Não informado</option>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            </label>
            <label>
              Observações
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: animal agitado, sombra parcial…" />
            </label>
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: "100%", minHeight: 56 }} disabled={!step1Valid} onClick={() => setStep(2)}>
          Ir para a câmera →
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "1.2rem" }}>Fotos da sessão</h2>
        <button className="btn btn-secondary" style={{ minHeight: 40, padding: "6px 12px" }} onClick={() => setStep(1)}>
          ← Voltar
        </button>
      </div>

      <div className="card" style={{ padding: 10, fontSize: "0.85rem" }}>
        <strong>#{selectedAnimal?.ear_tag}</strong> · {selectedAnimal?.breed ?? "raça não informada"} ·{" "}
        {Number(weight).toLocaleString("pt-BR")} kg
        <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
          {selectedPoint?.name} — câmera a {selectedPoint?.distance_cm} cm / {selectedPoint?.camera_height_cm} cm
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
        className="btn btn-primary"
        style={{ width: "100%", minHeight: 56, marginTop: 12 }}
        disabled={photos.length < MIN_PHOTOS || saving}
        onClick={handleSave}
      >
        {saving ? "Salvando…" : `Salvar sessão (${photos.length} fotos)`}
      </button>
      <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "center" }}>
        A sessão é salva no celular e enviada quando houver internet.
      </p>
    </div>
  );
}