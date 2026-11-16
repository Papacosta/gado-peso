/** Orientação/inclinação do aparelho (DeviceOrientation + DeviceMotion). */
import type { OrientationReading, MotionReading } from "../types";

let latestOrientation: OrientationReading = {
  available: false,
  alpha: null,
  beta: null,
  gamma: null,
  absolute: null,
  tilt_deg: null,
};

let latestMotion: MotionReading = {
  available: false,
  acceleration: { x: null, y: null, z: null },
  acceleration_including_gravity: { x: null, y: null, z: null },
  rotation_rate: { alpha: null, beta: null, gamma: null },
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function onOrientationChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getOrientation(): OrientationReading {
  return latestOrientation;
}

export function getMotion(): MotionReading {
  return latestMotion;
}

/** Solicita permissão no iOS (13+). Deve ser chamada via gesto do usuário. */
export async function requestOrientationPermission(): Promise<boolean> {
  const win = window as unknown as {
    DeviceOrientationEvent?: { requestPermission?: () => Promise<"granted" | "denied"> };
  };
  if (win.DeviceOrientationEvent?.requestPermission) {
    try {
      const res = await win.DeviceOrientationEvent.requestPermission();
      return res === "granted";
    } catch {
      return false;
    }
  }
  return true;
}

function handleOrientation(e: DeviceOrientationEvent) {
  const alpha = e.alpha ?? null;
  const beta = e.beta ?? null;
  const gamma = e.gamma ?? null;
  const absolute = e.absolute ?? null;

  let tilt: number | null = null;
  if (beta !== null && gamma !== null) {
    tilt = Math.sqrt(beta * beta + gamma * gamma);
  }

  latestOrientation = {
    available: true,
    alpha,
    beta,
    gamma,
    absolute,
    tilt_deg: tilt,
  };
  notify();
}

function handleMotion(e: DeviceMotionEvent) {
  const acc = e.acceleration
    ? { x: e.acceleration.x, y: e.acceleration.y, z: e.acceleration.z }
    : { x: null, y: null, z: null };
  const accGrav = e.accelerationIncludingGravity
    ? { x: e.accelerationIncludingGravity.x, y: e.accelerationIncludingGravity.y, z: e.accelerationIncludingGravity.z }
    : { x: null, y: null, z: null };
  const rot = e.rotationRate
    ? { alpha: e.rotationRate.alpha, beta: e.rotationRate.beta, gamma: e.rotationRate.gamma }
    : { alpha: null, beta: null, gamma: null };

  latestMotion = {
    available: true,
    acceleration: acc,
    acceleration_including_gravity: accGrav,
    rotation_rate: rot,
  };
  notify();
}

/** Inicia escuta. Deve ser chamada após permissão concedida (iOS). */
export function startOrientation(): void {
  // Evita listeners duplicados ao reativar sensores.
  window.removeEventListener("deviceorientation", handleOrientation);
  window.removeEventListener("devicemotion", handleMotion);
  window.addEventListener("deviceorientation", handleOrientation, { passive: true });
  window.addEventListener("devicemotion", handleMotion, { passive: true });
}

export function stopOrientation(): void {
  window.removeEventListener("deviceorientation", handleOrientation);
  window.removeEventListener("devicemotion", handleMotion);
}