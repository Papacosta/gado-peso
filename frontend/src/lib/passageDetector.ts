/**
 * Detector de passagem para câmera FIXA (sem rede neural no celular).
 *
 * Ideia: com a câmera parada, o "fundo" (corredor/brete vazio) não muda.
 * Comparamos cada quadro reduzido com o fundo e com o quadro anterior:
 *  - pixels diferentes do fundo = primeiro plano (animal);
 *  - diferença com o quadro anterior = movimento (borrão).
 *
 * Uma máquina de estados decide quando um animal ENTRA, quando está
 * inteiro e centralizado (bom momento para fotografar) e quando SAI.
 * Ao sair, a passagem é encerrada com os melhores quadros.
 *
 * Tudo aqui é puro (sem DOM) para poder ser testado/simulado.
 */

export interface DetectorConfig {
  /** Diferença mínima de cinza (0-255) para contar como primeiro plano. */
  diffThreshold: number;
  /** Fração mínima de uma coluna/linha em primeiro plano para entrar na caixa. */
  projectionThreshold: number;
  /** Fração do quadro em primeiro plano para considerar "animal presente". */
  enterFraction: number;
  /** Abaixo disso o animal saiu (histerese). */
  exitFraction: number;
  /** Quadros seguidos acima de enterFraction para iniciar a passagem. */
  enterFrames: number;
  /** Tempo (ms) abaixo de exitFraction para encerrar a passagem. */
  exitMs: number;
  /** Margem lateral (fração da largura) que a caixa não pode tocar. */
  edgeMargin: number;
  /** Largura mínima da caixa (fração da largura) para valer como foto. */
  minBoxWidth: number;
  /**
   * Movimento de referência (0-255) entre quadros analisados. Só entra na
   * pontuação: o borrão real é medido na foto em alta resolução.
   */
  motionRef: number;
  /** Intervalo mínimo (ms) entre quadros aceitos. */
  minCaptureGapMs: number;
  /** Quantos quadros manter por passagem (os melhores). */
  maxFrames: number;
  /** Mínimo de quadros bons para a passagem valer. */
  minFrames: number;
  /** Passagem mais longa que isso gera aviso (animal parado / fundo mudou). */
  stuckMs: number;
  /** Taxa de adaptação do fundo quando a cena está vazia (luz mudando). */
  backgroundLearningRate: number;
}

export const DEFAULT_DETECTOR_CONFIG: DetectorConfig = {
  diffThreshold: 28,
  projectionThreshold: 0.25,
  enterFraction: 0.08,
  exitFraction: 0.03,
  enterFrames: 2,
  exitMs: 1200,
  edgeMargin: 0.03,
  minBoxWidth: 0.2,
  motionRef: 20,
  minCaptureGapMs: 250,
  maxFrames: 5,
  minFrames: 2,
  stuckMs: 45000,
  backgroundLearningRate: 0.05,
};

export interface FrameMetrics {
  /** Fração do quadro em primeiro plano (0-1). */
  foreground: number;
  /** Movimento médio em relação ao quadro anterior (0-255). */
  motion: number;
  /** Caixa do animal em frações (0-1), ou null se não houver. */
  box: { x0: number; y0: number; x1: number; y1: number } | null;
  /** Caixa inteira dentro do quadro, sem tocar as laterais. */
  fullyInside: boolean;
  /** Distância do centro da caixa ao centro do quadro (0 = centralizado). */
  offCenter: number;
}

/** Converte RGBA (ImageData) em cinza. */
export function toGray(rgba: Uint8ClampedArray, w: number, h: number): Float32Array {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    gray[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
  }
  return gray;
}

/** Calcula primeiro plano, caixa e movimento de um quadro reduzido. */
export function analyzeFrame(
  gray: Float32Array,
  background: Float32Array,
  previous: Float32Array | null,
  w: number,
  h: number,
  cfg: DetectorConfig = DEFAULT_DETECTOR_CONFIG
): { metrics: FrameMetrics; mask: Uint8Array } {
  const mask = new Uint8Array(w * h);
  const colCount = new Uint32Array(w);
  const rowCount = new Uint32Array(h);
  let fg = 0;
  let motionSum = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (Math.abs(gray[i] - background[i]) > cfg.diffThreshold) {
        mask[i] = 1;
        fg += 1;
        colCount[x] += 1;
        rowCount[y] += 1;
      }
      if (previous) motionSum += Math.abs(gray[i] - previous[i]);
    }
  }

  const foreground = fg / (w * h);
  const motion = previous ? motionSum / (w * h) : 0;

  // Caixa pela projeção: colunas/linhas com bastante primeiro plano.
  // Isso ignora ruído espalhado (folhas, poeira, sombras finas).
  let x0 = -1;
  let x1 = -1;
  for (let x = 0; x < w; x++) {
    if (colCount[x] / h >= cfg.projectionThreshold) {
      if (x0 < 0) x0 = x;
      x1 = x;
    }
  }
  let y0 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    if (rowCount[y] / w >= cfg.projectionThreshold * 0.5) {
      if (y0 < 0) y0 = y;
      y1 = y;
    }
  }

  let box: FrameMetrics["box"] = null;
  let fullyInside = false;
  let offCenter = 1;
  if (x0 >= 0 && y0 >= 0) {
    box = { x0: x0 / w, y0: y0 / h, x1: (x1 + 1) / w, y1: (y1 + 1) / h };
    const marginPx = Math.max(1, Math.round(cfg.edgeMargin * w));
    // Colunas da borda também não podem ter primeiro plano relevante:
    // a cabeça ou a garupa podem estar saindo do quadro.
    let edgeHit = false;
    for (let x = 0; x < marginPx; x++) {
      if (colCount[x] / h >= cfg.projectionThreshold * 0.5 || colCount[w - 1 - x] / h >= cfg.projectionThreshold * 0.5) {
        edgeHit = true;
        break;
      }
    }
    fullyInside = !edgeHit && box.x0 >= cfg.edgeMargin && box.x1 <= 1 - cfg.edgeMargin;
    offCenter = Math.abs((box.x0 + box.x1) / 2 - 0.5) * 2;
  }

  return { metrics: { foreground, motion, box, fullyInside, offCenter }, mask };
}

/** Pontuação de um quadro candidato (maior = melhor). */
export function frameScore(m: FrameMetrics, sharpness: number, cfg: DetectorConfig = DEFAULT_DETECTOR_CONFIG): number {
  if (!m.box) return 0;
  const centered = 1 - Math.min(1, m.offCenter);
  const still = 1 - Math.min(1, m.motion / Math.max(cfg.motionRef, 1e-6));
  const sharp = Math.min(1, sharpness / 200);
  return 0.45 * centered + 0.3 * still + 0.25 * sharp;
}

/** Atualiza o fundo (média móvel) — só quando a cena está vazia. */
export function updateBackground(background: Float32Array, gray: Float32Array, rate: number): void {
  for (let i = 0; i < background.length; i++) {
    background[i] = background[i] * (1 - rate) + gray[i] * rate;
  }
}

export type TrackerState = "idle" | "present";

export type TrackerEvent =
  | { type: "enter"; at: number }
  | { type: "candidate"; at: number; score: number }
  | { type: "exit"; at: number; startedAt: number }
  | { type: "stuck"; at: number; startedAt: number };

/**
 * Máquina de estados da passagem. Recebe métricas por quadro e devolve
 * eventos. O chamador captura a foto em alta resolução no evento
 * "candidate" e encerra/envia a passagem no evento "exit".
 */
export class PassageTracker {
  state: TrackerState = "idle";
  startedAt = 0;
  private enterStreak = 0;
  private lowSince: number | null = null;
  private lastCandidateAt = -Infinity;
  private stuckWarned = false;

  constructor(private cfg: DetectorConfig = DEFAULT_DETECTOR_CONFIG) {}

  reset(): void {
    this.state = "idle";
    this.startedAt = 0;
    this.enterStreak = 0;
    this.lowSince = null;
    this.lastCandidateAt = -Infinity;
    this.stuckWarned = false;
  }

  /**
   * Força o fim da passagem atual e começa outra imediatamente — para gado
   * em fila encostado (o fundo nunca aparece entre um e outro). Usado pelo
   * botão "Próximo animal" e pela leitura de um novo brinco.
   */
  split(now: number): TrackerEvent[] {
    if (this.state !== "present") return [];
    const ev: TrackerEvent = { type: "exit", at: now, startedAt: this.startedAt };
    this.startedAt = now;
    this.lowSince = null;
    this.lastCandidateAt = -Infinity;
    this.stuckWarned = false;
    return [ev, { type: "enter", at: now }];
  }

  step(m: FrameMetrics, now: number, sharpness = 200): TrackerEvent[] {
    const cfg = this.cfg;
    const events: TrackerEvent[] = [];

    if (this.state === "idle") {
      this.enterStreak = m.foreground >= cfg.enterFraction ? this.enterStreak + 1 : 0;
      if (this.enterStreak >= cfg.enterFrames) {
        this.state = "present";
        this.startedAt = now;
        this.lowSince = null;
        this.lastCandidateAt = -Infinity;
        this.stuckWarned = false;
        events.push({ type: "enter", at: now });
      } else {
        return events;
      }
    }

    // --- presente ---
    if (m.foreground < cfg.exitFraction) {
      if (this.lowSince === null) this.lowSince = now;
      if (now - this.lowSince >= cfg.exitMs) {
        events.push({ type: "exit", at: now, startedAt: this.startedAt });
        this.state = "idle";
        this.enterStreak = 0;
        this.lowSince = null;
        return events;
      }
    } else {
      this.lowSince = null;
    }

    const good =
      m.box !== null &&
      m.fullyInside &&
      m.box.x1 - m.box.x0 >= cfg.minBoxWidth;
    if (good && now - this.lastCandidateAt >= cfg.minCaptureGapMs) {
      this.lastCandidateAt = now;
      events.push({ type: "candidate", at: now, score: frameScore(m, sharpness, cfg) });
    }

    if (!this.stuckWarned && now - this.startedAt >= cfg.stuckMs) {
      this.stuckWarned = true;
      events.push({ type: "stuck", at: now, startedAt: this.startedAt });
    }
    return events;
  }
}

/** Mantém só os N melhores itens por pontuação (estável por ordem de chegada). */
export function keepBest<T extends { score: number }>(items: T[], item: T, max: number): { kept: T[]; dropped: T | null } {
  const next = [...items, item];
  if (next.length <= max) return { kept: next, dropped: null };
  let worst = 0;
  for (let i = 1; i < next.length; i++) if (next[i].score < next[worst].score) worst = i;
  const dropped = next[worst];
  next.splice(worst, 1);
  return { kept: next, dropped };
}
