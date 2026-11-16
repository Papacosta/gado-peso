/**
 * Profundidade/distância até o animal.
 *
 * Android Chrome com WebXR depth-sensing/hit-test: a medição é opcional e
 * feita em uma sessão AR separada (o usuário aponta para o animal e toca).
 * iOS/LiDAR: WebXR não está disponível no Safari; o campo fica nulo e a
 * interface foi desenhada para receber um provider nativo no futuro.
 */
import type { DepthReading } from "../types";

export const noDepth: DepthReading = {
  available: false,
  distance_m: null,
  method: "webxr-depth",
};

/** Verifica suporte sem abrir sessão. */
export async function probeDepthSupport(): Promise<{ supported: boolean; reason: string }> {
  const nav = navigator as Navigator & {
    xr?: {
      isSessionSupported: (mode: string) => Promise<boolean>;
    };
  };
  if (!nav.xr) {
    return { supported: false, reason: "WebXR indisponível neste navegador." };
  }
  try {
    const supported = await nav.xr.isSessionSupported("immersive-ar");
    return {
      supported,
      reason: supported
        ? "WebXR AR disponível; a distância pode ser medida pelo botão AR."
        : "WebXR AR não suportado neste dispositivo.",
    };
  } catch {
    return { supported: false, reason: "Falha ao consultar WebXR." };
  }
}

declare global {
  interface Window {
    XRSession?: unknown;
  }
}

/**
 * Abre uma sessão AR, faz hit-test no primeiro toque e retorna a distância
 * (metros) da câmera até o ponto tocado. Retorna null se falhar.
 */
export async function measureDistanceWithAR(): Promise<number | null> {
  const nav = navigator as Navigator & {
    xr?: {
      requestSession: (
        mode: string,
        init?: Record<string, unknown>
      ) => Promise<XRSessionLike>;
    };
  };
  if (!nav.xr) return null;

  let session: XRSessionLike | null = null;
  try {
    session = await nav.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["depth-sensing", "dom-overlay"],
      domOverlay: { root: document.body },
    });

    const renderer = (session as unknown as { renderState?: { baseLayer?: unknown } });
    void renderer;

    const viewerSpace = await session.requestReferenceSpace("viewer");
    const hitTestSource = await session.requestHitTestSource!({ space: viewerSpace });
    let result: number | null = null;

    session.addEventListener("select", async (event: EventLike) => {
      try {
        const frame = event.frame as XRFrameLike;
        const pose = frame.getHitTestResults?.(hitTestSource)?.[0]?.getPose(viewerSpace);
        if (pose) {
          const p = pose.transform.position;
          result = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
        }
      } finally {
        await session?.end();
      }
    });

    await session.start?.(undefined as never);
    // O usuário toca na tela para medir; aguarda até 20s.
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        session?.end();
        resolve();
      }, 20000);
      session!.addEventListener("end", () => {
        clearTimeout(timer);
        resolve();
      });
    });

    return result && result > 0 ? Math.round(result * 100) / 100 : null;
  } catch {
    try {
      await session?.end();
    } catch {
      /* ignore */
    }
    return null;
  }
}

// Tipos mínimos para não depender de @types/webxr.
interface XRSessionLike {
  requestReferenceSpace: (type: string) => Promise<unknown>;
  requestHitTestSource?: (init: { space: unknown }) => Promise<unknown>;
  addEventListener: (type: string, fn: (event: EventLike) => void) => void;
  end: () => Promise<void>;
  start?: (options: unknown) => Promise<void>;
}
interface EventLike {
  frame?: XRFrameLike;
}
interface XRFrameLike {
  getHitTestResults?: (source: unknown) => Array<{ getPose: (space: unknown) => { transform: { position: { x: number; y: number; z: number } } } | undefined }>;
}