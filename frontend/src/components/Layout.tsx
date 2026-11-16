import { useEffect, useState, type ReactNode } from "react";
import { onQueueChange, queueCount, syncQueue } from "../lib/queue";
import { showToast } from "../lib/toast";

interface LayoutProps {
  route: string;
  children: ReactNode;
}

const NAV = [
  { path: "/", label: "Início", icon: "home" },
  { path: "/passagem", label: "Pesar", icon: "scale" },
  { path: "/coletar", label: "Coletar", icon: "camera" },
  { path: "/painel", label: "Painel", icon: "chart" },
  { path: "/animais", label: "Animais", icon: "tag" },
  { path: "/ajustes", label: "Ajustes", icon: "settings" },
];

function Icon({ name }: { name: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" {...common} aria-hidden="true">
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
      );
    case "camera":
      return (
        <svg viewBox="0 0 24 24" {...common} aria-hidden="true">
          <path d="M4 7h3l2-3h6l2 3h3v13H4z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      );
    case "scale":
      return (
        <svg viewBox="0 0 24 24" {...common} aria-hidden="true">
          <path d="M12 3v3M5 21h14M7 21l1-11h8l1 11" />
          <path d="M9 14a3 3 0 0 0 6 0" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 24 24" {...common} aria-hidden="true">
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
      );
    case "tag":
      return (
        <svg viewBox="0 0 24 24" {...common} aria-hidden="true">
          <path d="M20 12 12 4H4v8l8 8z" />
          <circle cx="8" cy="8" r="1.2" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-.4-1.1 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.1-.4 1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 .4 1.1 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.1.38.32.72.6 1 .3.27.7.4 1.1.4H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.1.4 1.7 1.7 0 0 0-.6 1z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function Layout({ route, children }: LayoutProps) {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      queueCount().then((n) => mounted && setPending(n)).catch(() => undefined);
    };
    refresh();
    const off = onQueueChange(refresh);
    const interval = window.setInterval(refresh, 15000);
    const online = () => {
      void handleSync();
    };
    window.addEventListener("online", online);
    return () => {
      mounted = false;
      off();
      window.clearInterval(interval);
      window.removeEventListener("online", online);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await syncQueue();
      if (result.synced > 0) showToast(`${result.synced} item(ns) sincronizado(s).`, "success");
      if (result.errors.length && result.pending > 0) {
        showToast(`Fila pendente: ${result.errors[0]}`, "warning");
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <header
        style={{
          background: "var(--primary)",
          color: "#fff",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>Gado Peso</div>
          <div style={{ fontSize: "0.7rem", opacity: 0.8 }}>câmera fixa · coleta padronizada</div>
        </div>
        <button
          className="btn"
          onClick={handleSync}
          disabled={syncing}
          style={{
            background: pending > 0 ? "var(--accent)" : "rgba(255,255,255,0.15)",
            color: pending > 0 ? "#212121" : "#fff",
            padding: "8px 12px",
            minHeight: 40,
            fontSize: "0.8rem",
          }}
          title="Sincronizar fila offline"
        >
          {syncing ? "Sincronizando…" : pending > 0 ? `${pending} na fila` : "Sincronizado"}
        </button>
      </header>

      <main>{children}</main>

      <nav className="bottom-nav">
        {NAV.map((item) => (
          <a
            key={item.path}
            href={`#${item.path}`}
            className={`nav-btn ${route === item.path ? "active" : ""}`}
            aria-current={route === item.path ? "page" : undefined}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}