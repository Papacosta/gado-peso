import { useEffect, useState } from "react";
import { api, apiError } from "../api";
import { cacheGet, cacheSet, enqueue } from "../lib/queue";
import { nowIso, uuid } from "../lib/format";
import { showToast } from "../lib/toast";
import { CATEGORY_LABELS, SEX_LABELS } from "../lib/format";
import type { Animal } from "../types";

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

  async function handleSave() {
    if (!form.ear_tag.trim()) {
      showToast("Informe o brinco/ID do animal.", "warning");
      return;
    }
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
      setForm({ ...EMPTY });
      setShowForm(false);
      showToast("Animal cadastrado.", "success");
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
        setForm({ ...EMPTY });
        setShowForm(false);
        showToast("Sem conexão: animal salvo na fila local.", "warning");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Animais ({animals.length})</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Fechar" : "+ Novo"}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">Cadastro do animal</div>
          <div className="form-row" style={{ marginTop: 8 }}>
            <label>
              Brinco / ID *
              <input value={form.ear_tag} onChange={(e) => setForm({ ...form, ear_tag: e.target.value })} placeholder="Ex.: 1042" />
            </label>
            <div className="form-row two">
              <label>
                Raça
                <input value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} placeholder="Nelore, Angus…" />
              </label>
              <label>
                Sexo
                <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                  <option value="">—</option>
                  <option value="macho">Macho</option>
                  <option value="femea">Fêmea</option>
                </select>
              </label>
            </div>
            <div className="form-row two">
              <label>
                Categoria
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">—</option>
                  <option value="bezerro">Bezerro</option>
                  <option value="novilha">Novilha</option>
                  <option value="vaca">Vaca</option>
                  <option value="boi">Boi</option>
                </select>
              </label>
              <label>
                Idade aprox. (meses)
                <input type="number" min={0} value={form.age_months} onChange={(e) => setForm({ ...form, age_months: e.target.value })} />
              </label>
            </div>
            <label>
              Escore de condição corporal (1–9, opcional)
              <input type="number" min={0} max={9} step={0.5} value={form.bcs} onChange={(e) => setForm({ ...form, bcs: e.target.value })} />
            </label>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : "Salvar animal"}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {animals.map((a) => (
          <div key={a.id} className="card" style={{ padding: 12, marginBottom: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>#{a.ear_tag}</strong>
              <span className="badge badge-ok">{CATEGORY_LABELS[a.category ?? ""] ?? a.category ?? "sem categoria"}</span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>
              {[a.breed, SEX_LABELS[a.sex ?? ""] ?? a.sex, a.age_months ? `${a.age_months} meses` : null]
                .filter(Boolean)
                .join(" · ") || "Sem detalhes"}
            </div>
          </div>
        ))}
        {animals.length === 0 && (
          <div className="card" style={{ textAlign: "center", color: "var(--text-muted)" }}>
            Nenhum animal cadastrado ainda. Toque em “+ Novo”.
          </div>
        )}
      </div>
    </div>
  );
}