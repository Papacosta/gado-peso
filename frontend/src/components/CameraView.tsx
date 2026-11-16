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

  return (
    <div>
      {!ready && !error && <div className="card">Abrindo câmera…</div>}
      <button className="btn btn-secondary" style={{ width: "100%", marginBottom: 8 }} onClick={enableSensors}>
        {sensorsOn ? "↻ Reativar sensores" : "📱 Ativar nível e sensores do celular"}
      </button>
      {error && (
        <div className="card" style={{ color: "var(--danger)" }}>
          <strong>Erro:</strong> {error}
          <div style={{ fontSize: "0.8rem", marginTop: 6 }}>
            A câmera do navegador exige HTTPS ou localhost. Cadastre os animais e pesagens com fotos
            de um aparelho que permita câmera, ou use o app instalado via PWA.
          </div>
        </div>
      )}

      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000" }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: "100%", display: "block", minHeight: 260 }}
        />
        {/* Overlay de enquadramento: guias laterais e silhueta central */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
          aria-hidden="true"
        >
          <rect x="1" y="1" width="98" height="98" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.5" strokeDasharray="4 3" />
          <line x1="50" y1="1" x2="50" y2="83" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" strokeDasharray="3 3" />
          <line x1="6" y1="43" x2="94" y2="43" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" strokeDasharray="3 3" />
          {/* Silhueta estilizada de cabeça/tronco/pernas (guia de escala) */}
          <ellipse cx="50" cy="55" rx="30" ry="13" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.6" />
          <ellipse cx="18" cy="50" rx="5" ry="9" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.6" />
          <line x1="34" y1="66" x2="36" y2="84" stroke="rgba(255,255,255,0.45)" strokeWidth="0.6" />
          <line x1="66" y1="66" x2="64" y2="84" stroke="rgba(255,255,255,0.45)" strokeWidth="0.6" />
          <text x="50" y="93" fontSize="3.2" fill="rgba(255,255,255,0.8)" textAnchor="middle">
            corpo centralizado · zoom 1x · distância fixa
          </text>
        </svg>
      </div>

      <TiltIndicator tiltDeg={tilt} beta={beta} gamma={gamma} maxTilt={maxTilt} />

      <Checklist
        checked={checked}
        onChange={(i, value) => {
          setChecked((prev) => {
            const next = [...prev];
            next[i] = value;
            return next;
          });
        }}
      />

      <SensorChips snapshot={lastSnapshot} />
      {cameraInfo && (
        <details className="card" style={{ padding: 10 }}>
          <summary style={{ fontSize: "0.85rem", fontWeight: 600 }}>Detalhes da câmera</summary>
          <pre style={{ fontSize: "0.65rem", whiteSpace: "pre-wrap", margin: 0 }}>
            {JSON.stringify(cameraInfo, null, 2)}
          </pre>
        </details>
      )}
      <div className="card" style={{ fontSize: "0.75rem", color: depth.supported ? "var(--success)" : "var(--text-muted)", padding: 10 }}>
        Profundidade (WebXR): {depth.supported ? "suportada — use o botão AR para medir a distância" : depth.reason || "indisponível"}
      </div>
      {lastQuality && (
        <div
          className="card"
          style={{
            padding: 10,
            fontSize: "0.78rem",
            color: lastQuality.warning ? "var(--warning)" : "var(--success)",
          }}
        >
          {lastQuality.warning
            ? lastQuality.warning
            : "Qualidade aparentemente ok (nitidez e luz). Enviei as leituras junto com a foto."}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          className="btn btn-primary"
          onClick={handleCapture}
          disabled={!canCapture}
          style={{ flex: 1, minHeight: 56, fontSize: "1.1rem" }}
        >
          📷 Capturar ({photos.length}/{maxPhotos})
        </button>
        {tiltBlocked && !override && (
          <button
            className="btn btn-warning"
            onClick={() => setOverride(true)}
            title="Disparar mesmo com inclinação"
            style={{ minWidth: 56 }}
          >
            ⚠
          </button>
        )}
      </div>

      {photos.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
            {photos.map((p) => (
              <div key={p.id} style={{ position: "relative", flexShrink: 0 }}>
                <img
                  src={p.previewUrl}
                  alt={`Foto ${p.id}`}
                  style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }}
                />
                <button
                  onClick={() => {
                    onRemovePhoto(p.id);
                    URL.revokeObjectURL(p.previewUrl);
                  }}
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    borderRadius: "50%",
                    width: 24,
                    height: 24,
                    background: "var(--danger)",
                    color: "#fff",
                    border: "2px solid #fff",
                  }}
                  aria-label="Remover foto"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {photos.length < minPhotos && (
            <div style={{ fontSize: "0.8rem", color: "var(--warning)" }}>
              O protocolo pede de {minPhotos} a {maxPhotos} fotos por sessão. Capture mais{" "}
              {minPhotos - photos.length} foto(s).
            </div>
          )}
        </div>
      )}
    </div>
  );
}