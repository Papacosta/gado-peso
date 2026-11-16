/** Fila offline em IndexedDB + cache local de cadastros. */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { QueueItem } from "../types";
import { api } from "../api";

interface GadoDB extends DBSchema {
  queue: {
    key: string;
    value: QueueItem;
    indexes: { "by-createdAt": number };
  };
}

let dbPromise: Promise<IDBPDatabase<GadoDB>> | null = null;

function getDB(): Promise<IDBPDatabase<GadoDB>> {
  if (!dbPromise) {
    dbPromise = openDB<GadoDB>("gado-peso", 1, {
      upgrade(db) {
        const store = db.createObjectStore("queue", { keyPath: "id" });
        store.createIndex("by-createdAt", "createdAt");
      },
    });
  }
  return dbPromise;
}

export async function enqueue(item: QueueItem): Promise<void> {
  const db = await getDB();
  await db.put("queue", item);
  notify();
}

export async function queueItems(): Promise<QueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex("queue", "by-createdAt");
}

export async function removeQueueItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("queue", id);
  notify();
}

export async function clearQueue(): Promise<void> {
  const db = await getDB();
  await db.clear("queue");
  notify();
}

export async function queueCount(): Promise<number> {
  const db = await getDB();
  return db.count("queue");
}

// ---------------------------------------------------------------------------
// Sincronização: envia na ordem em que foi criado (ponto -> animal -> pesagem
// -> fotos). Em caso de erro, para para não furar dependências.
// ---------------------------------------------------------------------------
export interface SyncResult {
  synced: number;
  pending: number;
  errors: string[];
}

export async function syncQueue(): Promise<SyncResult> {
  if (!navigator.onLine) {
    return { synced: 0, pending: await queueCount(), errors: ["Sem internet."] };
  }

  const items = await queueItems();
  let synced = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      if (item.kind === "capturePoint") {
        await api.createCapturePoint(item.payload as never);
      } else if (item.kind === "animal") {
        await api.createAnimal(item.payload as never);
      } else if (item.kind === "weighing") {
        await api.createWeighing(item.payload);
      } else if (item.kind === "passage") {
        await api.createPassage({
          passageId: item.id,
          capturePointId: item.capturePointId,
          startedAt: item.startedAt,
          endedAt: item.endedAt,
          earTag: item.earTag,
          lot: item.lot,
          frames: item.frames,
        });
      } else {
        await api.uploadPhoto({
          photoId: item.id,
          weighingId: item.weighingId,
          blob: item.blob,
          capturedAt: item.capturedAt,
          sensors: item.sensors,
          width: item.width,
          height: item.height,
        });
      }
      await removeQueueItem(item.id);
      synced += 1;
    } catch (err) {
      errors.push(`${item.kind}: ${err instanceof Error ? err.message : String(err)}`);
      break; // preserva a ordem das dependências
    }
  }

  const pending = await queueCount();
  notify();
  return { synced, pending, errors };
}

// ---------------------------------------------------------------------------
// Eventos simples para a UI reagir à fila
// ---------------------------------------------------------------------------
type Listener = () => void;
const listeners = new Set<Listener>();

export function onQueueChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

// ---------------------------------------------------------------------------
// Cache local (localStorage) para cadastros usados offline
// ---------------------------------------------------------------------------
export function cacheSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`gado:${key}`, JSON.stringify(value));
  } catch {
    /* quota cheia: ignora */
  }
}

export function cacheGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`gado:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Configurações locais (tolerância de inclinação etc.). */
export const localSettings = {
  get maxTilt(): number {
    return Number(localStorage.getItem("gado:maxTilt") ?? "5");
  },
  set maxTilt(value: number) {
    localStorage.setItem("gado:maxTilt", String(value));
  },
  get capturePointId(): string | null {
    return localStorage.getItem("gado:capturePointId");
  },
  set capturePointId(value: string | null) {
    if (value) localStorage.setItem("gado:capturePointId", value);
    else localStorage.removeItem("gado:capturePointId");
  },
};
