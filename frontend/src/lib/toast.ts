/** Toast global simples (mensagens de sucesso/erro). */
export type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

type Listener = (toast: Toast) => void;
const listeners = new Set<Listener>();
let nextId = 1;

export function showToast(message: string, type: ToastType = "success"): void {
  const toast: Toast = { id: nextId++, message, type };
  listeners.forEach((fn) => fn(toast));
}

export function onToast(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
