import { useEffect, useState } from "react";
import { api } from "../api";
import { formatNumber } from "../lib/format";
import type { DashboardStats } from "../types";

export default function Home() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api.dashboard()
      .then((d) => mounted && setStats(d))
      .catch((e) => mounted && setError(e.message ?? String(e)))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}>Carregando…</div>;
  if (error || !stats) return <div className="card" style={{ color: "var(--danger)" }}>Erro: {error ?? "Dados não disponíveis"}</div>;

  return (
    <div>
      <div className="card" style={{ marginTop: 8 }}>
        <div className="card-title">Visão rápida</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 8 }}>
          <StatCard label="Animais" value={stats.total_animals} />
          <StatCard label="Pesagens" value={stats.total_weighings} />
          <StatCard label="Fotos" value={stats.total_photos} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Distribuição de peso</div>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {stats.weights.map((b) => (
            <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ minWidth: 100, fontSize: "0.85rem" }}>{b.label}</span>
              <div style={{ flex: 1, height: 16, background: "#e8f5e9", borderRadius: 8, position: "relative", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.min(100, (b.count / Math.max(1, stats.total_weighings)) * 100)}%`,
                    height: "100%",
                    background: "var(--primary)",
                    transition: "width 0.3s",
                  }}
                />
              </div>
              <span style={{ minWidth: 36, textAlign: "right", fontWeight: 600 }}>{b.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Avisos</div>
        <ul style={{ margin: 8, paddingLeft: 18 }}>
          {stats.warnings.map((w, i) => (
            <li key={i} style={{ marginBottom: 6, fontSize: "0.85rem", color: "var(--warning)" }}>
              {w}
            </li>
          ))}
          {stats.warnings.length === 0 && (
            <li style={{ color: "var(--success)" }}>Tudo dentro do esperado. 👍</li>
          )}
        </ul>
      </div>

      <div className="card">
        <div className="card-title">Modelo</div>
        <div style={{ marginTop: 8 }}>
          <span className="badge">{stats.model_status.active ? "Ativo" : "Inativo"}</span>
          {stats.model_status.active && stats.model_status.active.metrics.mae_kg && (
            <span style={{ marginLeft: 8, fontSize: "0.85rem" }}>
              MAE ≈ {stats.model_status.active.metrics.mae_kg.toFixed(1)} kg
            </span>
          )}
          {stats.model_status.reason && (
            <div style={{ marginTop: 6, fontSize: "0.8rem", color: "var(--text-muted)" }}>
              {stats.model_status.reason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "16px 8px" }}>
      <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--primary)" }}>
        {formatNumber(value, 0)}
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}