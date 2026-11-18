import { useEffect, useState } from "react";
import { api } from "../api";
import { clearQueue, localSettings, queueCount, syncQueue } from "../lib/queue";
import { showToast } from "../lib/toast";
import PageHeader from "../components/PageHeader";
import { APP_NAME } from "../lib/brand";
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
  const [health, setHealth] = useState<"verificando" | "online" | "offline">("verificando");
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
      lines.push("Permissão de movimento negada. No iPhone: Ajustes > Safari > Movimento e Orientação.");
    }
    setDiag(lines);
  }

  const healthLabel = { verificando: "verificando…", online: "conectado", offline: "sem conexão" }[health];

  return (
    <div>
      <PageHeader title="Ajustes" />

      <section className="card" aria-labelledby="aj-ponto">
        <h2 id="aj-ponto" className="card-title" style={{ marginTop: 0 }}>Pontos de captura</h2>
        <p className="small muted">Onde o celular fica fixo, com a distância e a altura da câmera.</p>
        <a href="#/pontos" className="btn btn-secondary btn-block">
          Gerenciar pontos de captura
        </a>
      </section>

      <section className="card" aria-labelledby="aj-conexao">
        <h2 id="aj-conexao" className="card-title" style={{ marginTop: 0 }}>Envio de dados</h2>
        <p className="small" style={{ margin: "6px 0" }}>
          Servidor:{" "}
          <span className={`badge ${health === "online" ? "badge-ok" : health === "offline" ? "badge-danger" : "badge-neutral"}`}>
            {healthLabel}
          </span>
        </p>
        <p className="small">
          Aguardando envio: <strong>{pending}</strong> item(ns)
        </p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              const r = await syncQueue();
              setPending(r.pending);
              showToast(
                r.errors.length ? `Ainda aguardando envio: ${r.errors[0]}` : `${r.synced} item(ns) enviado(s).`,
                r.errors.length ? "warning" : "success"
              );
            }}
          >
            Enviar agora
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={pending === 0}
            onClick={async () => {
              if (
                confirm(
                  `Apagar ${pending} item(ns) que ainda não foram enviados ao servidor?\n\nEsses dados (pesagens e fotos) serão perdidos e não dá para desfazer.`
                )
              ) {
                await clearQueue();
                setPending(0);
                showToast("Itens não enviados apagados.", "warning");
              }
            }}
          >
            Apagar não enviados
          </button>
        </div>
      </section>

      <section className="card" aria-labelledby="aj-inclinacao">
        <h2 id="aj-inclinacao" className="card-title" style={{ marginTop: 0 }}>Inclinação máxima do celular</h2>
        <p className="small muted" id="incl-ajuda">
          Se o celular estiver mais torto que isso, o app pede para endireitar antes da foto.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <label htmlFor="inclinacao" className="sr-only">Inclinação máxima em graus</label>
          <input
            id="inclinacao"
            type="range"
            min={1}
            max={20}
            step={1}
            value={maxTilt}
            aria-describedby="incl-ajuda"
            aria-valuetext={`${maxTilt} graus`}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMaxTilt(v);
              localSettings.maxTilt = v;
            }}
            style={{ flex: 1 }}
          />
          <strong style={{ minWidth: 48 }} aria-hidden="true">{maxTilt}°</strong>
        </div>
      </section>

      <section className="card" aria-labelledby="aj-export">
        <h2 id="aj-export" className="card-title" style={{ marginTop: 0 }}>Exportar dados</h2>
        <p className="small muted">
          Planilha (CSV) com pesos, animais e sensores. O arquivo ZIP inclui também as fotos.
        </p>
        <div className="btn-row">
          <a className="btn btn-secondary" href={api.exportCsvUrl()} download>
            Baixar planilha (CSV)
          </a>
          <a className="btn btn-secondary" href={api.exportZipUrl()} download>
            Baixar tudo com fotos (ZIP)
          </a>
        </div>
      </section>

      <section className="card" aria-labelledby="aj-instalar">
        <h2 id="aj-instalar" className="card-title" style={{ marginTop: 0 }}>Instalar na tela inicial</h2>
        <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
          <li>Android (Chrome): menu ⋮ → “Instalar app” ou “Adicionar à tela inicial”.</li>
          <li>iPhone (Safari): botão Compartilhar → “Adicionar à Tela de Início”.</li>
        </ul>
      </section>

      <details className="card">
        <summary>Diagnóstico dos sensores (avançado)</summary>
        <button type="button" className="btn btn-secondary btn-block" onClick={testSensors}>
          Testar sensores deste celular
        </button>
        {diag.length > 0 && (
          <ul className="small" style={{ marginTop: 10, paddingLeft: 18 }} aria-live="polite">
            {diag.map((line, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{line}</li>
            ))}
          </ul>
        )}
        {depth && <p className="small muted" style={{ marginTop: 8 }}>{depth.reason}</p>}
      </details>

      <p className="small muted" style={{ textAlign: "center" }}>
        {APP_NAME} · versão 0.2.0. Nenhum dado de terceiros é usado: o modelo aprende só com as suas pesagens.
      </p>
    </div>
  );
}
