import { useCallback, useEffect, useRef, useState } from "react";
import TiltIndicator from "./TiltIndicator";
import Checklist, { DEFAULT_CHECKLIST } from "./Checklist";
import SensorChips from "./SensorChips";
import {
  startCamera,
  stopCamera,
  captureFrame,
  getCamera,
  startOrientation,
  stopOrientation,
  requestOrientationPermission,
  startAmbientLight,
  stopAmbientLight,
  readGeolocation,
  collectSensorSnapshot,
  getOrientation,
  onOrientationChange,
  probeDepthSupport,
  type CapturedFrame,
} from "../sensors";
import { quickQuality, type QuickQuality } from "../lib/imageQuality";
import { localSettings } from "../lib/queue";
import type { SensorSnapshot } from "../types";

export interface CapturedShot {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  sensors: SensorSnapshot;
  quality: QuickQuality;
  previewUrl: string;
}

interface CameraViewProps {
  minPhotos: number;
  maxPhotos: number;
  photos: CapturedShot[];
  onCapture: (shot: CapturedShot) => void;
  onRemovePhoto: (id: string) => void;
}

export default function CameraView({ minPhotos, maxPhotos, photos, onCapture, onRemovePhoto }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tilt, setTilt] = useState<number | null>(null);
  const [beta, setBeta] = useState<number | null>(null);
  const [gamma, setGamma] = useState<number | null>(null);
  const [cameraInfo, setCameraInfo] = useState<ReturnType<typeof getCamera> | null>(null);
  const [checked, setChecked] = useState<boolean[]>(() => DEFAULT_CHECKLIST.map(() => false));
  const [lastQuality, setLastQuality] = useState<QuickQuality | null>(null);
  const [depth, setDepth] = useState<{ supported: boolean; reason: string }>({ supported: false, reason: "" });
  const [override, setOverride] = useState(false);
  const [sensorsOn, setSensorsOn] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState<SensorSnapshot | null>(null);
  const maxTilt = localSettings.maxTilt;

  async function enableSensors() {
    const granted = await requestOrientationPermission();
    if (granted) {
      startOrientation();
      startAmbientLight();
      setSensorsOn(true);
    }
  }

  // ---------------- permissões e inicialização ----------------
  useEffect(() => {
    let cancelled = false;
    let streamCleanup: (() => void) | null = null;

    (async () => {
      const granted = await requestOrientationPermission();
      if (!cancelled) {
        if (granted) startOrientation();
        startAmbientLight();
        void readGeolocation(); // opcional, silencioso
        void probeDepthSupport().then((d) => !cancelled && setDepth(d));
        const off = onOrientationChange(() => {
          const o = getOrientation();
          setTilt(o.tilt_deg);
          setBeta(o.beta);
          setGamma(o.gamma);
        });
        cleanupRef.current.push(off);
      }
      if (videoRef.current) {
        try {
          await startCamera(videoRef.current);
          streamCleanup = stopCamera;
          if (!cancelled) {
            setReady(true);
            setCameraInfo(getCamera());
          }
        } catch (err) {
          if (!cancelled) {
            const name = (err as DOMException)?.name ?? "";
            setError(
              name === "NotAllowedError"
                ? "Permissão da câmera negada. Habilite o acesso nas configurações do navegador."
                : name === "NotFoundError"
                  ? "Nenhuma câmera encontrada neste dispositivo."
                  : `Falha ao abrir a câmera: ${name || "erro desconhecido"}. Verifique se o site está em HTTPS (ou localhost).`
            );
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      streamCleanup?.();
      stopOrientation();
      stopAmbientLight();
    };
  }, []);

  const cleanupRef = useRef<(() => void)[]>([]);

  // foto capturada
  const allChecked = checked.every(Boolean);
  const tiltBlocked = tilt !== null && tilt > maxTilt;
  const canCapture = ready && allChecked && (photos.length < maxPhotos) && (!tiltBlocked || override);

  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const frame: CapturedFrame = await captureFrame(video);
    const snapshot = await collectSensorSnapshot({ withGeolocation: false });
    const quality = quickQuality(frame.canvas);
    if (snapshot.ambient_light.available === false) {
      snapshot.ambient_light = {
        available: false,
        lux: Math.round(quality.brightness * 4),
        source: "image_fallback",
      };
    }
    setLastQuality(quality);
    setLastSnapshot(snapshot);
    setOverride(false);
    onCapture({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      blob: frame.blob,
      width: frame.width,
      height: frame.height,
      sensors: snapshot,
      quality,
      previewUrl: URL.createObjectURL(frame.blob),
    });
  }, [onCapture]);

  const blockReason = !ready
    ? "Aguarde a câmera abrir."
    : photos.length >= maxPhotos
      ? `Limite de ${maxPhotos} fotos atingido. Remova uma para tirar outra.`
      : !allChecked
        ? `Marque os ${checked.filter((c) => !c).length} item(ns) que faltam no checklist.`
        : tiltBlocked && !override
          ? `Celular inclinado (${tilt?.toFixed(1)}°, limite ${maxTilt}°). Endireite o tripé.`
          : null;

  return (
    <div>
      {!ready && !error && (
        <p className="card" role="status">
          Abrindo câmera…
        </p>
      )}
      {error && (
        <div className="alert alert-error" role="alert">
          <strong>Não foi possível usar a câmera.</strong>
          {error}
          <div className="small" style={{ marginTop: 6 }}>
            O navegador só libera a câmera em sites seguros (endereço com https). Se o problema continuar,
            reabra o app pelo ícone da tela inicial.
          </div>
        </div>
      )}

      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000" }}>
        <video
          ref={videoRef}
          playsInline
          muted
          aria-label="Imagem ao vivo da câmera"
          style={{ width: "100%", display: "block", minHeight: 260 }}
        />
        {/* Guia de enquadramento: bordas, linhas centrais e silhueta do animal */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
          aria-hidden="true"
        >
          <rect x="1" y="1" width="98" height="98" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.5" strokeDasharray="4 3" />
          <line x1="50" y1="1" x2="50" y2="83" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" strokeDasharray="3 3" />
          <line x1="6" y1="43" x2="94" y2="43" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" strokeDasharray="3 3" />
          <ellipse cx="50" cy="55" rx="30" ry="13" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.6" />
          <ellipse cx="18" cy="50" rx="5" ry="9" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.6" />
          <line x1="34" y1="66" x2="36" y2="84" stroke="rgba(255,255,255,0.45)" strokeWidth="0.6" />
          <line x1="66" y1="66" x2="64" y2="84" stroke="rgba(255,255,255,0.45)" strokeWidth="0.6" />
        </svg>
      </div>
      <p className="small muted" style={{ margin: "6px 0 8px" }}>
        Encaixe o animal inteiro de lado, dentro da silhueta, sem usar zoom.
      </p>

      <TiltIndicator tiltDeg={tilt} beta={beta} gamma={gamma} maxTilt={maxTilt} />
      {tilt === null && !sensorsOn && (
        <button type="button" className="btn btn-secondary btn-block" style={{ marginBottom: 8 }} onClick={enableSensors}>
          Ativar o nível do celular
        </button>
      )}

      <Checklist
        checked={checked}
        onChange={(i, value) => {
          setChecked((prev) => {
            const next = [...prev];
            next[i] = value;
            return next;
          });
        }}
        onCheckAll={() => setChecked(DEFAULT_CHECKLIST.map(() => true))}
      />

      {lastQuality && (
        <div className={`alert ${lastQuality.warning ? "alert-warn" : ""}`} role="status">
          <strong>{lastQuality.warning ? "Confira a última foto" : "Última foto ok"}</strong>
          {lastQuality.warning ?? "Nitidez e iluminação parecem boas."}
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary btn-block btn-lg"
        onClick={handleCapture}
        disabled={!canCapture}
        aria-describedby="captura-motivo"
      >
        📷 Tirar foto ({photos.length} de {maxPhotos})
      </button>
      <p id="captura-motivo" className="small" style={{ margin: "6px 0 0", color: blockReason ? "var(--warning)" : "var(--text-muted)" }}>
        {blockReason ?? "Pronto para fotografar."}
      </p>
      {tiltBlocked && !override && (
        <button type="button" className="btn btn-warning btn-block" style={{ marginTop: 8 }} onClick={() => setOverride(true)}>
          Fotografar mesmo inclinado
        </button>
      )}

      {photos.length > 0 && (
        <section className="card" style={{ marginTop: 12 }} aria-label="Fotos tiradas">
          <ul style={{ display: "flex", gap: 12, overflowX: "auto", padding: "8px 4px", margin: 0, listStyle: "none" }}>
            {photos.map((p, i) => (
              <li key={p.id} style={{ position: "relative", flexShrink: 0 }}>
                <img
                  src={p.previewUrl}
                  alt={`Foto ${i + 1}`}
                  style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 8, display: "block" }}
                />
                <button
                  type="button"
                  onClick={() => {
                    onRemovePhoto(p.id);
                    URL.revokeObjectURL(p.previewUrl);
                  }}
                  style={{
                    position: "absolute",
                    top: -10,
                    right: -10,
                    borderRadius: "50%",
                    width: 44,
                    height: 44,
                    background: "var(--danger)",
                    color: "#fff",
                    border: "3px solid #fff",
                    fontSize: "1rem",
                    cursor: "pointer",
                  }}
                  aria-label={`Remover foto ${i + 1}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          {photos.length < minPhotos && (
            <p className="small" style={{ color: "var(--warning)", margin: "4px 0 0" }}>
              Tire de {minPhotos} a {maxPhotos} fotos. Faltam {minPhotos - photos.length}.
            </p>
          )}
        </section>
      )}

      <details className="card" style={{ padding: "4px 12px", marginTop: 12 }}>
        <summary className="small">Informações técnicas dos sensores</summary>
        <SensorChips snapshot={lastSnapshot} />
        <p className="small muted">
          Profundidade (WebXR): {depth.supported ? "suportada neste aparelho" : depth.reason || "indisponível"}
        </p>
        {sensorsOn && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={enableSensors}>
            Reativar sensores
          </button>
        )}
        {cameraInfo && (
          <pre style={{ fontSize: "0.75rem", whiteSpace: "pre-wrap", margin: "8px 0" }}>
            {JSON.stringify(cameraInfo, null, 2)}
          </pre>
        )}
      </details>
    </div>
  );
}
