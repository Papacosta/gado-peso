/** Análise rápida de qualidade no cliente (aviso antes de salvar). */
export interface QuickQuality {
  brightness: number;
  blurScore: number;
  isDark: boolean;
  isBlurry: boolean;
  warning: string | null;
}

/** Reduz a imagem e calcula brilho médio + variância do Laplaciano. */
export function quickQuality(canvas: HTMLCanvasElement): QuickQuality {
  const targetW = 320;
  const scale = Math.min(1, targetW / Math.max(canvas.width, 1));
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));

  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const ctx = small.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { brightness: 0, blurScore: 0, isDark: false, isBlurry: false, warning: null };
  }
  ctx.drawImage(canvas, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  // Escala de cinza
  const gray = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    const v = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
    gray[i] = v;
    sum += v;
  }
  const brightness = sum / (w * h);

  // Laplaciano 4-vizinhos e variância
  let lapSum = 0;
  let lapSqSum = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w];
      lapSum += lap;
      lapSqSum += lap * lap;
      count += 1;
    }
  }
  const mean = count ? lapSum / count : 0;
  const blurScore = count ? lapSqSum / count - mean * mean : 0;

  const isDark = brightness < 55;
  const isBlurry = blurScore < 60;
  let warning: string | null = null;
  if (isBlurry) warning = "Foto possivelmente borrada. Segure firme e aguarde o foco.";
  else if (isDark) warning = "Foto escura. Melhore a iluminação do animal.";

  return { brightness, blurScore, isDark, isBlurry, warning };
}