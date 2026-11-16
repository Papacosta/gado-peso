/** Luminosidade ambiente: sensor nativo quando existe; fallback na imagem. */
import type { AmbientLightReading } from "../types";

let latestLight: AmbientLightReading = {
  available: false,
  lux: null,
  source: "image_fallback",
};

interface AmbientLightSensorLike {
  start: () => void;
  stop: () => void;
  addEventListener: (type: string, fn: () => void) => void;
  illuminance?: number;
}

let sensor: AmbientLightSensorLike | null = null;

export function getAmbientLight(): AmbientLightReading {
  return latestLight;
}

export function startAmbientLight(): void {
  const ctor = (window as unknown as { AmbientLightSensor?: new () => AmbientLightSensorLike })
    .AmbientLightSensor;
  if (!ctor) return;
  try {
    const s = new ctor();
    sensor = s;
    s.addEventListener("reading", () => {
      latestLight = {
        available: true,
        lux: typeof s.illuminance === "number" ? s.illuminance : null,
        source: "sensor",
      };
    });
    s.start();
  } catch {
    latestLight = { available: false, lux: null, source: "image_fallback" };
  }
}

export function stopAmbientLight(): void {
  try {
    sensor?.stop();
  } catch {
    /* ignore */
  }
  sensor = null;
}

/** Luminância média (0-255) de um canvas/imagem, para fallback de luz. */
export function estimateBrightnessFromCanvas(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;
  const { width, height } = canvas;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 160));
  const data = ctx.getImageData(0, 0, width, height).data;
  let sum = 0;
  let count = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      // luminância ITU-R BT.601
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      count += 1;
    }
  }
  return count ? sum / count : 0;
}