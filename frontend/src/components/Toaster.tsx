import { useEffect, useState } from "react";
import { onToast, type ToastType } from "../lib/toast";

interface ToastState {
  id: number;
  message: string;
  type: ToastType;
}

export default function Toaster() {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const off = onToast((t) => {
      setToast(t);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setToast(null), 4500);
    });
    return () => {
      off();
      window.clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;
  const cls =
    toast.type === "success"
      ? "toast-success"
      : toast.type === "error"
        ? "toast-error"
        : toast.type === "warning"
          ? "toast-warning"
          : "";
  return (
    <div className={`toast ${cls}`} role="status" onClick={() => setToast(null)}>
      {toast.message}
    </div>
  );
}