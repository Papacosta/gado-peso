/** Interface única de sensores usada pelo app. */
import type { SensorSnapshot } from "../types";
import { getCamera } from "./camera";
import { getGeolocation, readGeolocation } from "./geolocation";
import { getAmbientLight } from "./ambientLight";
import { getMotion, getOrientation } from "./orientation";

export { startOrientation, stopOrientation, requestOrientationPermission, getOrientation, getMotion, onOrientationChange } from "./orientation";
export { startCamera, stopCamera, getCamera, captureFrame, getVideoTrack, type CapturedFrame } from "./camera";
export { readGeolocation, getGeolocation } from "./geolocation";
export { startAmbientLight, stopAmbientLight, getAmbientLight, estimateBrightnessFromCanvas } from "./ambientLight";
export { probeDepthSupport, measureDistanceWithAR, noDepth } from "./depth";

// Distância medida via AR (opcional). Fica em memória para a próxima foto.
let measuredDistance: number | null = null;

export function setMeasuredDistance(distance: number | null): void {
  measuredDistance = distance;
}

export function getMeasuredDistance(): number | null {
  return measuredDistance;
}

export interface DepthSupport {
  supported: boolean;
  reason: string;
}

export async function collectSensorSnapshot(options?: {
  withGeolocation?: boolean;
}): Promise<SensorSnapshot> {
  const orientation = getOrientation();
  const motion = getMotion();
  const camera = getCamera();
  const ambient = getAmbientLight();

  const geo = options?.withGeolocation ? await readGeolocation() : getGeolocation();

  const depth = {
    available: measuredDistance !== null,
    distance_m: measuredDistance,
    method: measuredDistance !== null ? "webxr-depth" : "webxr-depth",
  };

  return {
    orientation: { ...orientation },
    motion: { ...motion },
    camera: { ...camera },
    geolocation: { ...geo },
    ambient_light: { ...ambient },
    depth,
    device: {
      user_agent: navigator.userAgent,
      platform: navigator.platform ?? null,
    },
    quality: { warnings: [], sensor_score: 0 },
  };
}