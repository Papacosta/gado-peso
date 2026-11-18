import { useEffect, useState } from "react";
import { api, apiError } from "../api";
import { cacheGet, cacheSet, enqueue } from "../lib/queue";
import { nowIso, uuid } from "../lib/format";
import { showToast } from "../lib/toast";
import { CATEGORY_LABELS, SEX_LABELS } from "../lib/format";
import type { Animal } from "../types";
import PageHeader from "../components/PageHeader";

const EMPTY = {
  ear_tag: "",
  breed: "",
  sex: "",
  category: "",
  age_months: "",
  bcs: "",
};

export default function Animais() {
  const [animals, setAnimals] = useState<Animal[]>(() => cacheGet<Animal[]>("animals", []));
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [tried, setTried] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.listAnimals()
      .then((list) => {
        const cached = cacheGet<Animal[]>("animals", []);
        // Preserva cadastros feitos offline ainda não sincronizados.
        const merged = [...list, ...cached.filter((c) => !list.some((a) => a.id === c.id))];
        setAnimals(merged);
        cacheSet("animals", merged);
      })
      .catch(() => {
        /* offline: mantém cache */
      });
  }, []);

  const tag = form.ear_tag.trim();
  const duplicate = tag !== "" && animals.some((a) => a.ear_tag.toLowerCase() === tag.toLowerCase());
  const tagError = !tag ? "Informe o número do brinco." : duplicate ? `Já existe um animal com o brinco ${tag}.` : null;
  const bcsError =
    form.bcs && (Number(form.bcs) < 1 || Number(form.bcs) > 9) ? "O escore corporal vai de 1 a 9." : null;
  const ageError = form.age_months && Number(form.age_months) < 0 ? "A idade não pode ser negativa." : null;

  const q = query.trim().toLowerCase();
  const visible = q
    ? animals.filter((a) => [a.ear_tag, a.breed, a.category].some((v) => v?.toLowerCase().includes(q)))
    : animals;

  function closeForm() {
    setForm({ ...EMPTY });
    setTried(false);
    setShowForm(false);
  }

  async function handleSave() {
    setTried(true);
    if (tagError || bcsError || ageError) return;
    setSaving(true);
    try {
      const payload = {
        ear_tag: form.ear_tag.trim(),
        breed: form.breed || null,
        sex: form.sex || null,
        category: form.category || null,
        age_months: form.age_months ? Number(form.age_months) : null,
        bcs: form.bcs ? Number(form.bcs) : null,
      };
      const created = await api.createAnimal(payload);
      const next = [created, ...animals.filter((a) => a.id !== created.id)];
      setAnimals(next);
      cacheSet("animals", next);
      closeForm();
      showToast(`Animal com brinco ${created.ear_tag} cadastrado.`, "success");
    } catch (err) {
      const message = apiError(err);
      if (message.toLowerCase().includes("já existe")) {
        showToast(message, "error");
      } else {
        // Sem internet/servidor: salva na fila e segue a coleta offline.
        const id = uuid();
        const local: Animal = {
          id,
          ear_tag: form.ear_tag.trim(),
          breed: form.breed || null,
          sex: form.sex || null,
          category: form.category || null,
          age_months: form.age_months ? Number(form.age_months) : null,
          bcs: form.bcs ? Number(form.bcs) : null,
          notes: null,
          created_at: nowIso(),
        };
        await enqueue({
          kind: "animal",
          id,
          createdAt: Date.now(),
          payload: { ...local },
        });
        const next = [local, ...animals];
        setAnimals(next);
        cacheSet("animals", next);
        closeForm();
        showToast("Sem conexão: animal salvo no celular e será enviado depois.", "info");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={`Animais (${animals.length})`}
        description="Cadastre cada animal pelo número do brinco antes de coletar."
        action={
          !showForm && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
              + Cadastrar
            </button>
          )
        }
      />

      {showForm && (
        <form
          className="card"
          noValidate
          aria-labelledby="novo-animal"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <h2 id="novo-animal" className="card-title" style={{ marginTop: 0 }}>
            Novo animal
          </h2>
          <p className="form-note">
            Só o brinco é obrigatório (<span className="req">*</span>). O resto ajuda o modelo a errar menos.
          </p>
          <div className="form-row">
            <div className="field">
              <label htmlFor="brinco" className="field-label">
                Brinco / identificação <span className="req">*</span>
              </label>
              <input
                id="brinco"
                autoFocus
                required
                autoComplete="off"
                value={form.ear_tag}
                onChange={(e) => setForm({ ...form, ear_tag: e.target.value })}
                placeholder="Ex.: 1042"
                aria-invalid={(tried || duplicate) && Boolean(tagError)}
                aria-describedby="brinco-erro"
              />
              {(tried || duplicate) && tagError && (
                <span id="brinco-erro" className="field-error">
                  {tagError}
                </span>
              )}
            </div>
            <div className="form-row two">
              <div className="field">
                <label htmlFor="raca" className="field-label">Raça</label>
                <input id="raca" value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} placeholder="Nelore, Angus…" />
              </div>
              <div className="field">
                <label htmlFor="sexo" className="field-label">Sexo</label>
                <select id="sexo" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                  <option value="">Não informado</option>
                  <option value="macho">Macho</option>
                  <option value="femea">Fêmea</option>
                </select>
              </div>
            </div>
            <div className="form-row two">
              <div className="field">
                <label htmlFor="categoria" className="field-label">Categoria</label>
                <select id="categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">Não informada</option>
                  <option value="bezerro">Bezerro</option>
                  <option value="novilha">Novilha</option>
                  <option value="vaca">Vaca</option>
                  <option value="boi">Boi</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="idade" className="field-label">Idade aproximada (meses)</label>
                <input
                  id="idade"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.age_months}
                  onChange={(e) => setForm({ ...form, age_months: e.target.value })}
                  aria-invalid={Boolean(ageError)}
                  aria-describedby="idade-erro"
                />
                {ageError && <span id="idade-erro" className="field-error">{ageError}</span>}
              </div>
            </div>
            <div className="field">
              <label htmlFor="escore" className="field-label">Escore de condição corporal</label>
              <input
                id="escore"
                type="number"
                inputMode="decimal"
                min={1}
                max={9}
                step={0.5}
                value={form.bcs}
                onChange={(e) => setForm({ ...form, bcs: e.target.value })}
                aria-invalid={Boolean(bcsError)}
                aria-describedby="escore-ajuda escore-erro"
              />
              <span id="escore-ajuda" className="field-hint">
                De 1 (muito magro) a 9 (muito gordo). Opcional.
              </span>
              {bcsError && <span id="escore-erro" className="field-error">{bcsError}</span>}
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn-secondary" onClick={closeForm}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Salvando…" : "Salvar animal"}
              </button>
            </div>
          </div>
        </form>
      )}

      {animals.length > 6 && (
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="busca" className="field-label">Buscar animal</label>
          <input
            id="busca"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Brinco, raça ou categoria"
          />
        </div>
      )}

      <ul style={{ display: "grid", gap: 8, listStyle: "none", padding: 0, margin: 0 }} aria-label="Animais cadastrados">
        {visible.map((a) => (
          <li key={a.id} className="card" style={{ padding: 12, marginBottom: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong>Brinco {a.ear_tag}</strong>
              <span className="badge badge-ok">{CATEGORY_LABELS[a.category ?? ""] ?? a.category ?? "Sem categoria"}</span>
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>
              {[a.breed, SEX_LABELS[a.sex ?? ""] ?? a.sex, a.age_months ? `${a.age_months} meses` : null]
                .filter(Boolean)
                .join(" · ") || "Sem detalhes"}
            </div>
          </li>
        ))}
      </ul>
      {animals.length === 0 && (
        <div className="card muted" style={{ textAlign: "center" }}>
          Nenhum animal cadastrado ainda. Toque em “+ Cadastrar”.
        </div>
      )}
      {animals.length > 0 && visible.length === 0 && (
        <p className="card muted" role="status">
          Nenhum animal encontrado para “{query}”.
        </p>
      )}
    </div>
  );
}
