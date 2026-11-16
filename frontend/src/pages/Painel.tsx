import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { api, apiError } from "../api";
import { showToast } from "../lib/toast";
import type { DashboardStats } from "../types";

const COLORS = ["#2e7d32", "#43a047", "#66bb6a", "#9ccc65", "#c0ca33", "#ffb300", "#f4511e", "#6d4c41"];

export default function Painel() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [training, setTraining] = useState(false);

  useEffect(() => {
    api.dashboard().then(setStats).catch((e) => setError(apiError(e)));
  }, []);

  if (error) return <div className="card" style={{ color: "var(--danger)" }}>{error}</div>;
  if (!stats) return <div style={{ padding: 32, textAlign: "center" }}>Carregando painel…</div>;

  const weightData = stats.weights;

  const breedData = Object.entries(stats.by_breed).map(([label, value]) => ({ name: label, value }));

  async function handleTrain(algorithm: "ridge" | "gboost") {
    setTraining(true);
    try {
      const res = await api.train(algorithm);
      showToast(res.message, "success");
      const updated = await api.dashboard();
      setStats(updated);
    } catch (e) {
      showToast(apiError(e), "error");
    } finally {
      setTraining(false);
    }
  }

  const m = stats.model_status.active?.metrics;

  return (
    <div>
      <h2 style={{ fontSize: "1.2rem" }}>Painel de coleta</h2>

      <div className="card">
        <div className="card-title">Metas de coleta</div>
        <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
          <Progress label="Animais" current={stats.total_animals} target={stats.min_animals_for_model} />
          <Progress label="Modelo útil (100+)" current={stats.total_animals} target={100} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Histograma de peso</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weightData} margin={{ left: -20, right: 10 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => [`${v} animais`, ""]} />
            <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="card-title">Por raça</div>
        {breedData.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Sem dados ainda.</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={breedData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={36} outerRadius={62} label>
                {breedData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: "0.7rem" }} />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card">
        <div className="card-title">Status do modelo</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <span className={`badge ${stats.model_status.active ? "badge-ok" : "badge-warn"}`}>
            {stats.model_status.active ? `Versão ${stats.model_status.active.version} (ativa)` : "Sem modelo ativo"}
          </span>
          <span className="badge badge-warn">
            {stats.model_status.animals_with_photos}/{stats.min_animals_for_model} animais com foto
          </span>
        </div>
        {stats.model_status.reason && (
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 8 }}>{stats.model_status.reason}</p>
        )}
        {m && (
          <ul style={{ fontSize: "0.85rem", marginTop: 8 }}>
            <li>MAE: {m.mae_kg?.toFixed(1)} kg · MAPE: {m.mape_pct?.toFixed(1)}%</li>
            <li>Bias: {m.bias_kg?.toFixed(1)} kg ({m.n_folds} folds por animal)</li>
            <li>Faixa usada nas estimativas: ±{m.interval_half_width_kg} kg</li>
          </ul>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={training || !stats.model_status.can_train} onClick={() => handleTrain("ridge")}>
            {training ? "Treinando…" : "🤖 Retreinar (Ridge)"}
          </button>
          <button className="btn btn-secondary" style={{ flex: 1 }} disabled={training || !stats.model_status.can_train} onClick={() => handleTrain("gboost")}>
            {training ? "…" : "🤖 Retreinar (GB)"}
          </button>
        </div>
        <a href="#/modelo" className="btn btn-ghost" style={{ width: "100%", marginTop: 8 }}>
          Ver estimativa e histórico →
        </a>
      </div>

      <div className="card">
        <div className="card-title">Avisos</div>
        {stats.warnings.length === 0 ? (
          <p style={{ color: "var(--success)", fontSize: "0.85rem" }}>Tudo dentro do esperado. 👍</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {stats.warnings.map((w, i) => (
              <li key={i} style={{ fontSize: "0.82rem", marginBottom: 6, color: "var(--warning)" }}>{w}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Progress({ label, current, target }: { label: string; current: number; target: number }) {
  const pct = Math.min(100, (current / Math.max(1, target)) * 100);
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ height: 14, background: "#e8f5e9", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--primary)", transition: "width 0.3s" }} />
      </div>
      <div style={{ fontSize: "0.7rem", marginTop: 2 }}>
        {current}/{target}
      </div>
    </div>
  );
}