import { useEffect, useState } from "react";
import { api } from "../api";
import { clearQueue, localSettings, queueCount, syncQueue } from "../lib/queue";
import { showToast } from "../lib/toast";
import {
  requestOrientationPermission,
  startOrientation,
  getOrientation,
  getMotion,
  getCamera,
  readGeolocation,
  getAmbientLight,
  probeDepthSupport,
  startAmbientLight,
} from "../sensors";

export default function Ajustes() {
  const [maxTilt, setMaxTilt] = useState(localSettings.maxTilt);
  const [pending, setPending] = useState(0);
  const [health, setHealth] = useState<string>("verificando…");
  const [diag, setDiag] = useState<string[]>([]);
  const [depth, setDepth] = useState<{ supported: boolean; reason: string } | null>(null);

  useEffect(() => {
    queueCount().then(setPending).catch(() => undefined);
    api.health().then(() => setHealth("online")).catch(() => setHealth("offline"));
    probeDepthSupport().then(setDepth).catch(() => undefined);
  }, []);

  async function testSensors() {
    const lines: string[] = [];
    const granted = await requestOrientationPermission();
    if (granted) {
      startOrientation();
      startAmbientLight();
      await new Promise((r) => setTimeout(r, 1200));
      const o = getOrientation();
      const m = getMotion();
      const c = getCamera();
      const g = await readGeolocation(4000);
      const l = getAmbientLight();
      lines.push(`Orientação: ${o.available ? `α=${o.alpha?.toFixed(0)} β=${o.beta?.toFixed(0)} γ=${o.gamma?.toFixed(0)} inclinação=${o.tilt_deg?.toFixed(1)}°` : "indisponível"}`);
      lines.push(`Movimento: ${m.available ? "disponível" : "indisponível"}`);
      lines.push(`Câmera: ${c.available ? `zoom=${c.zoom ?? "?"} · ImageCapture=${c.image_capture_supported ? "sim" : "não"}` : "indisponível (abra a câmera na coleta)"}`);
      lines.push(`Geolocalização: ${g.available ? `${g.latitude?.toFixed(5)}, ${g.longitude?.toFixed(5)} (±${g.accuracy_m?.toFixed(0)} m)` : "indisponível/negada"}`);
      lines.push(`Luz ambiente: ${l.available ? `${l.lux?.toFixed(0)} lux` : "sem sensor (usa brilho da imagem)"}`);
      const d = await probeDepthSupport();
      lines.push(`Profundidade: ${d.supported ? "WebXR AR suportado" : d.reason}`);
    } else {
      lines.push("Permissão de orientação negada (iOS). Habilite em Ajustes > Safari > Movimento e Orientação.");
    }
    setDiag(lines);
  }

  return (
    <div>
      <h2 style={{ fontSize: "1.2rem" }}>Ajustes</h2>

      <div className="card">
        <div className="card-title">Conexão</div>
        <p style={{ fontSize: "0.85rem", margin: "6px 0" }}>
          API: <span className={`badge ${health === "online" ? "badge-ok" : "badge-danger"}`}>{health}</span>
        </p>
        <p style={{ fontSize: "0.85rem" }}>
          Fila offline: <strong>{pending}</strong> item(ns)
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn btn-primary"
            onClick={async () => {
              const r = await syncQueue();
              setPending(r.pending);
              showToast(r.errors.length ? r.errors[0] : `${r.synced} item(ns) sincronizado(s).`, r.errors.length ? "warning" : "success");
            }}
          >
            Sincronizar agora
          </button>
          <button
            className="btn btn-danger"
            onClick={async () => {
              if (confirm("Apagar todos os itens não sincronizados? Essa ação não pode ser desfeita.")) {
                await clearQueue();
                setPending(0);
                showToast("Fila apagada.", "warning");
              }
            }}
          >
            Limpar fila
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Tolerância de inclinação</div>
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          Acima deste valor o app bloqueia o disparo (com opção de emergência).
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={maxTilt}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMaxTilt(v);
              localSettings.maxTilt = v;
            }}
            style={{ flex: 1, accentColor: "var(--primary)" }}
          />
          <strong style={{ minWidth: 48 }}>{maxTilt}°</strong>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Exportar dataset</div>
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          CSV com metadados, pesos e leituras de sensores; ZIP inclui as imagens.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <a className="btn btn-secondary" href={api.exportCsvUrl()} style={{ flex: 1 }}>
            ⬇ CSV
          </a>
          <a className="btn btn-secondary" href={api.exportZipUrl()} style={{ flex: 1 }}>
            ⬇ ZIP + fotos
          </a>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Diagnóstico de sensores</div>
        <button className="btn btn-secondary" onClick={testSensors} style={{ width: "100%" }}>
          Testar sensores deste celular
        </button>
        {diag.length > 0 && (
          <ul style={{ fontSize: "0.8rem", marginTop: 10, paddingLeft: 18 }}>
            {diag.map((line, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{line}</li>
            ))}
          </ul>
        )}
        {depth && (
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 8 }}>{depth.reason}</p>
        )}
      </div>

      <div className="card">
        <div className="card-title">Instalar como app (PWA)</div>
        <p style={{ fontSize: "0.82rem" }}>
          No Android/Chrome: menu ⋮ → “Instalar app” ou “Adicionar à tela inicial”.
          No iPhone/Safari: botão Compartilhar → “Adicionar à Tela de Início”.
          A câmera exige HTTPS (o compose já sobe com certificado autoassinado; aceite o aviso).
        </p>
      </div>

      <div className="card" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
        Versão 0.1.0 · Fase 1 completa · Fase 2 estruturada. Nenhum dado de terceiros é usado:
        todo o aprendizado vem das suas pesagens.
      </div>
    </div>
  );
}