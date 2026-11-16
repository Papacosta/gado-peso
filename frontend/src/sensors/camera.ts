/** Configurações da câmera e ImageCapture (quando disponível). */
import type { CameraReading } from "../types";

let latestCamera: CameraReading = {
  available: false,
  settings: {},
  capabilities: {},
  zoom: null,
  image_capture_supported: false,
};

let currentStream: MediaStream | null = null;
let imageCapture: ImageCaptureLike | null = null;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function onCameraChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getCamera(): CameraReading {
  return latestCamera;
}

export async function startCamera(
  videoEl: HTMLVideoElement,
  constraints?: MediaStreamConstraints
): Promise<MediaStream> {
  const defaultConstraints: MediaStreamConstraints = {
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  };
  const merged = constraints ? { ...defaultConstraints, video: { ...(defaultConstraints.video as object), ...(constraints.video as object) } } : defaultConstraints;

  try {
    const stream = await navigator.mediaDevices.getUserMedia(merged);
    currentStream = stream;
    videoEl.srcObject = stream;
    await videoEl.play();

    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings() as MediaTrackSettings & { zoom?: number };
    const capabilities = track.getCapabilities() as Record<string, unknown> & {
      zoom?: { min: number; max: number; step: number };
    };

    let zoom: number | null = settings.zoom ?? null;
    // Tenta forçar zoom 1x (sem zoom digital/óptico)
    if (capabilities.zoom && zoom !== 1.0) {
      try {
        await track.applyConstraints({ advanced: [{ zoom: 1.0 }] } as unknown as MediaTrackConstraints);
        const refreshed = track.getSettings() as MediaTrackSettings & { zoom?: number };
        zoom = refreshed.zoom ?? zoom;
      } catch {
        /* ignora se não suportar zoom exato */
      }
    }

    // ImageCapture para metadados e foto em resolução nativa (quando suportado)
    let imageCaptureSupported = false;
    const IC = (window as unknown as { ImageCapture?: new (tk: MediaStreamTrack) => ImageCaptureLike })
      .ImageCapture;
    if (IC) {
      try {
        imageCapture = new IC(track);
        imageCaptureSupported = true;
      } catch {
        /* não suportado */
        imageCapture = null;
      }
    }

    latestCamera = {
      available: true,
      settings: Object.fromEntries(Object.entries(settings)),
      capabilities: Object.fromEntries(Object.entries(capabilities)),
      zoom,
      image_capture_supported: imageCaptureSupported,
    };
    notify();
    return stream;
  } catch (err) {
    latestCamera = {
      available: false,
      settings: {},
      capabilities: {},
      zoom: null,
      image_capture_supported: false,
    };
    notify();
    throw err;
  }
}

export function stopCamera(): void {
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
    currentStream = null;
  }
  imageCapture = null;
  latestCamera = {
    available: false,
    settings: {},
    capabilities: {},
    zoom: null,
    image_capture_supported: false,
  };
  notify();
}

export function getImageCapture(): ImageCaptureLike | null {
  return imageCapture;
}

interface ImageCaptureLike {
  track: MediaStreamTrack;
  getPhotoCapabilities: () => Promise<{ photoWidth?: number; photoHeight?: number }>;
  takePhoto: () => Promise<Blob>;
}

export function getVideoTrack(): MediaStreamTrack | null {
  return currentStream?.getVideoTracks()[0] ?? null;
}

interface ImageCaptureLike {
  track: MediaStreamTrack;
  getPhotoCapabilities: () => Promise<{ photoWidth?: number; photoHeight?: number }>;
  takePhoto: () => Promise<Blob>;
}

export interface CapturedFrame {
  blob: Blob;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

/** Captura o frame atual do vídeo em JPEG, na resolução nativa. */

export async function captureFrame(
  videoEl: HTMLVideoElement,
  quality = 0.92
): Promise<CapturedFrame> {
  const width = videoEl.videoWidth;
  const height = videoEl.videoHeight;
  if (!width || !height) {
    throw new Error("Vídeo ainda não está pronto para capturar.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");
  ctx.drawImage(videoEl, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao codificar a foto em JPEG."))),
      "image/jpeg",
      quality
    );
  });
  return { blob, canvas, width, height };
}