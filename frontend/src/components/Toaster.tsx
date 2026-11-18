import { useEffect, useState } from "react";
import { onToast, type ToastType } from "../lib/toast";

interface ToastState {
  id: number;
  message: string;
  type: ToastType;
}

const TITLES: Record<ToastType, string> = {
  success: "Pronto",
  error: "Erro",
  warning: "Atenção",
  info: "Aviso",
};

/**
 * Mensagens rápidas. As regiões ao vivo ficam sempre no DOM (leitores de tela
 * só anunciam mudanças em regiões já existentes). Erros ficam mais tempo na
 * tela e podem ser fechados.
 */
export default function Toaster() {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const off = onToast((t) => {
      setToast(t);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setToast(null), t.type === "error" ? 10000 : 6000);
    });
    return () => {
      off();
      window.clearTimeout(timer);
    };
  }, []);

  const urgent = toast?.type === "error";
  const cls =
    toast?.type === "success"
      ? "toast-success"
      : toast?.type === "error"
        ? "toast-error"
        : toast?.type === "warning"
          ? "toast-warning"
          : "";

  const body = toast && (
    <div className={`toast ${cls}`}>
      <div>
        <span className="sr-only">{TITLES[toast.type]}: </span>
        {toast.message}
      </div>
      <button type="button" className="toast-close" onClick={() => setToast(null)} aria-label="Fechar mensagem">
        ×
      </button>
    </div>
  );

  return (
    <>
      <div role="status" aria-live="polite">{!urgent && body}</div>
      <div role="alert" aria-live="assertive">{urgent && body}</div>
    </>
  );
}
