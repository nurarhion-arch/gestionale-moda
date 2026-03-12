import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { fileToDataUrl } from "../lib/file";

const emptyVariant = (copyFromPrev = null, boxPrecompilato = undefined, tagliaPrecompilata = undefined) => ({
  colore: "",
  taglia:
    tagliaPrecompilata !== undefined && tagliaPrecompilata !== null
      ? String(tagliaPrecompilata)
      : copyFromPrev != null
        ? (copyFromPrev.taglia ?? "")
        : "",
  quantita: 0,
  box: boxPrecompilato !== undefined && boxPrecompilato !== null
    ? String(boxPrecompilato)
    : copyFromPrev != null
      ? (copyFromPrev.box ?? "")
      : ""
});
const TAGLIE_RIGHE = [
  ["S", "M", "L", "XL"],
  ["XS", "UNICA", "XXL"]
];

export default function NuovoArticoloPage() {
  const fileInputRef = useRef(null);
  const coloreRefs = useRef([]);
  const variantRowRefs = useRef([]);
  const boxRefs = useRef([]);
  const shouldScrollToNewRow = useRef(false);
  const lastBoxRef = useRef("");
  const lastTagliaRef = useRef("");
  const [form, setForm] = useState(() => ({
    codice_articolo: "",
    descrizione: "",
    composizione: "",
    prezzo: 0,
    foto_data_url: null,
    fornitore: "",
    cliente: "",
    varianti: [emptyVariant()]
  }));
  const [preferenzeLoaded, setPreferenzeLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [f, c] = await Promise.all([
          api.getPreferenza("sticky_fornitore"),
          api.getPreferenza("sticky_cliente")
        ]);
        if (!cancelled)
          setForm((prev) => ({ ...prev, fornitore: f || "", cliente: c || "" }));
      } finally {
        if (!cancelled) setPreferenzeLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [fotoPreview, setFotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [esito, setEsito] = useState(null);
  const [errore, setErrore] = useState(null);
  const [focusVarianteIdx, setFocusVarianteIdx] = useState(null);
  const [removeConfirmIdx, setRemoveConfirmIdx] = useState(null);

  const totaleQuantita = useMemo(
    () => form.varianti.reduce((acc, v) => acc + (Number(v.quantita) || 0), 0),
    [form.varianti]
  );

  const totaleValore = useMemo(
    () => (Number(form.prezzo) || 0) * (totaleQuantita || 0),
    [form.prezzo, totaleQuantita]
  );

  function scrollFieldIntoView(e) {
    const el = e.target;
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  }

  function updateField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
    if (name === "fornitore") api.setPreferenza("sticky_fornitore", value);
    if (name === "cliente") api.setPreferenza("sticky_cliente", value);
  }

  function updateVariante(idx, patch) {
    setForm((f) => ({
      ...f,
      varianti: f.varianti.map((v, i) => (i === idx ? { ...v, ...patch } : v))
    }));
  }

  function varianteCompleta(v) {
    const colore = String(v?.colore ?? "").trim();
    const taglia = String(v?.taglia ?? "").trim();
    const q = Number(v?.quantita);
    return colore.length > 0 && taglia.length > 0 && Number.isFinite(q) && q >= 0;
  }

  function updateVarianteAutoAdd(idx, patch) {
    let shouldFocusNextColore = null;
    setForm((f) => {
      const lastIdx = f.varianti.length - 1;
      const nextVarianti = f.varianti.map((v, i) => (i === idx ? { ...v, ...patch } : v));
      const updated = nextVarianti[idx];
      const q = Number(updated?.quantita);
      const quantitaInserita = Number.isFinite(q) && q > 0;

      if (idx === lastIdx && quantitaInserita) {
        shouldFocusNextColore = lastIdx + 1;
        const prev = nextVarianti[lastIdx];
        return { ...f, varianti: [...nextVarianti, emptyVariant(prev, lastBoxRef.current, lastTagliaRef.current)] };
      }
      if (quantitaInserita && idx < lastIdx) {
        shouldFocusNextColore = idx + 1;
      }
      return { ...f, varianti: nextVarianti };
    });
    if (shouldFocusNextColore !== null) {
      shouldScrollToNewRow.current = true;
      setFocusVarianteIdx(shouldFocusNextColore);
    }
  }

  function onColoreBlur(idx, e) {
    const v = form.varianti[idx];
    const colore = String(v?.colore ?? "").trim();
    const lastIdx = form.varianti.length - 1;
    if (idx !== lastIdx || colore === "") return;
    const focusStaysInRow = (() => {
      const rowEl = variantRowRefs.current[idx];
      return rowEl && e?.relatedTarget && rowEl.contains(e.relatedTarget);
    })();
    setForm((f) => {
      const prev = f.varianti[f.varianti.length - 1];
      return { ...f, varianti: [...f.varianti, emptyVariant(prev, lastBoxRef.current, lastTagliaRef.current)] };
    });
    if (!focusStaysInRow) {
      shouldScrollToNewRow.current = true;
      setFocusVarianteIdx(lastIdx + 1);
    } else {
      shouldScrollToNewRow.current = false;
    }
  }

  function addVariante() {
    setForm((f) => {
      const prev = f.varianti[f.varianti.length - 1];
      return { ...f, varianti: [...f.varianti, emptyVariant(prev, lastBoxRef.current, lastTagliaRef.current)] };
    });
  }

  function removeVariante(idx) {
    setForm((f) => {
      const next = f.varianti.filter((_, i) => i !== idx);
      return { ...f, varianti: next.length ? next : [emptyVariant()] };
    });
  }

  async function onPickFoto(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    updateField("foto_data_url", dataUrl);
    setFotoPreview(dataUrl);
  }

  useLayoutEffect(() => {
    if (focusVarianteIdx === null) return;
    const idx = focusVarianteIdx;
    const doScroll = shouldScrollToNewRow.current;
    setFocusVarianteIdx(null);
    shouldScrollToNewRow.current = false;
    const runFocusAndScroll = () => {
      const rowEl = variantRowRefs.current[idx];
      const inputEl = coloreRefs.current[idx];
      if (doScroll) {
        if (rowEl && typeof rowEl.scrollIntoView === "function") {
          rowEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        } else if (inputEl && typeof inputEl.scrollIntoView === "function") {
          inputEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        }
      }
      if (inputEl && typeof inputEl.focus === "function") {
        inputEl.focus();
      }
    };
    const id = setTimeout(runFocusAndScroll, 150);
    return () => clearTimeout(id);
  }, [focusVarianteIdx, form.varianti.length]);

  async function onSubmit(e) {
    e.preventDefault();
    setErrore(null);
    setEsito(null);
    setSaving(true);
    try {
      const variantiValide = form.varianti.filter((v) => String(v.colore ?? "").trim() !== "");
      if (variantiValide.length === 0) {
        setErrore("Inserisci almeno una variante con il colore compilato.");
        setSaving(false);
        return;
      }
      const payload = {
        ...form,
        prezzo: Number(form.prezzo) || 0,
        varianti: variantiValide.map((v) => ({
          colore: String(v.colore || "").trim(),
          taglia: String(v.taglia || "").trim(),
          quantita: Number(v.quantita) || 0,
          box: Number(v.box) || 0
        }))
      };
      const resp = await api.creaArticolo(payload);
      setEsito(`Articolo inserito (ID: ${resp.articolo_id}).`);
      setForm((prev) => ({
        codice_articolo: "",
        descrizione: "",
        composizione: "",
        prezzo: 0,
        foto_data_url: null,
        fornitore: prev.fornitore,
        cliente: prev.cliente,
        varianti: [emptyVariant()]
      }));
      setFotoPreview(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErrore(err.message || "Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page page--nuovo-articolo">
      <div className="page__title">Inserisci nuovo articolo</div>

      {esito ? <div className="alert alert--success">{esito}</div> : null}
      {errore ? <div className="alert alert--error">{errore}</div> : null}

      <form className="card" onSubmit={onSubmit}>
        <div className="grid grid--2">
          {/* 1. Cliente */}
          <label className="field">
            <div className="field__label">Cliente</div>
            <input
              value={form.cliente}
              onChange={(e) => updateField("cliente", e.target.value)}
              onFocus={scrollFieldIntoView}
              placeholder="Es. Zeyn"
            />
          </label>

          {/* 2. Fornitore */}
          <label className="field">
            <div className="field__label">Fornitore</div>
            <div className="row row--grow">
              <input
                value={form.fornitore}
                onChange={(e) => updateField("fornitore", e.target.value)}
                onFocus={scrollFieldIntoView}
                placeholder="Es. BLU ROYAL"
              />
            </div>
          </label>

          {/* 3. Foto */}
          <div className="field field--full">
            <div className="field__label">Foto</div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPickFoto}
              className="photoPicker__input"
            />

            <button
              type="button"
              className="photoPicker"
              onClick={() => fileInputRef.current?.click()}
              onFocus={scrollFieldIntoView}
              aria-label="Scatta o carica una foto"
            >
              <span className="photoPicker__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M9 7l1.2-1.6c.38-.5.97-.8 1.6-.8h.4c.63 0 1.22.3 1.6.8L15 7h2.2c1 0 1.8.8 1.8 1.8v9.4c0 1-.8 1.8-1.8 1.8H6.8c-1 0-1.8-.8-1.8-1.8V8.8C5 7.8 5.8 7 6.8 7H9z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 18a4 4 0 100-8 4 4 0 000 8z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                </svg>
              </span>
              <span className="photoPicker__text">
                {fotoPreview ? "Cambia foto" : "Scatta / Carica foto"}
              </span>
              {fotoPreview ? <span className="photoPicker__badge">OK</span> : null}
            </button>

            {fotoPreview ? (
              <div className="row">
                <img className="preview" src={fotoPreview} alt="Anteprima foto" />
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    updateField("foto_data_url", null);
                    setFotoPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  Rimuovi
                </button>
              </div>
            ) : null}
          </div>

          {/* 4. Articolo (codice) */}
          <label className="field field--articolo">
            <div className="field__label">Articolo</div>
            <input
              value={form.codice_articolo}
              onChange={(e) => updateField("codice_articolo", e.target.value)}
              onFocus={scrollFieldIntoView}
              placeholder="Es. ART-001"
              required
            />
          </label>

          {/* 5. Descrizione */}
          <label className="field field--descrizione">
            <div className="field__label">Descrizione</div>
            <input
              value={form.descrizione}
              onChange={(e) => updateField("descrizione", e.target.value)}
              onFocus={scrollFieldIntoView}
            />
          </label>

          {/* 6. Composizione */}
          <label className="field field--composizione">
            <div className="field__label">Composizione</div>
            <input
              value={form.composizione}
              onChange={(e) => updateField("composizione", e.target.value)}
              onFocus={scrollFieldIntoView}
              placeholder="Es. 100% cotone"
            />
          </label>

          {/* 7. Prezzo in Euro */}
          <label className="field field--prezzo">
            <div className="field__label">Prezzo (EUR)</div>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.prezzo}
              onChange={(e) => updateField("prezzo", e.target.value)}
              onFocus={scrollFieldIntoView}
              required
            />
          </label>
        </div>

        <div className="divider" />

        <div className="row row--between">
          <div>
            <div className="sectionTitle">Varianti</div>
            <div className="hint">
              Totale quantità: <b>{totaleQuantita}</b> &nbsp; | &nbsp; Totale articolo:&nbsp;
              <b>{totaleValore.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</b>
            </div>
          </div>
          <button type="button" className="btn btn--addVariant" onClick={addVariante} onFocus={scrollFieldIntoView}>
            + Aggiungi variante
          </button>
        </div>

        <div className="variants">
          {form.varianti.map((v, idx) => (
            <div
              key={idx}
              className="variantRow"
              ref={(el) => {
                variantRowRefs.current[idx] = el;
              }}
            >
              <div className="variantRow__cell variantRow__colore">
                <input
                  ref={(el) => {
                    coloreRefs.current[idx] = el;
                  }}
                  value={v.colore}
                  onChange={(e) => updateVariante(idx, { colore: e.target.value })}
                  onBlur={(e) => onColoreBlur(idx, e)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      boxRefs.current[idx]?.focus();
                    }
                  }}
                  onFocus={scrollFieldIntoView}
                  placeholder="Colore"
                  aria-label="Colore"
                />
              </div>

              <div className="variantRow__cell variantRow__taglie" role="group" aria-label="Taglia">
                <div className="sizePicker">
                  {TAGLIE_RIGHE.map((row, rIdx) => (
                    <div key={rIdx} className="sizeRow" aria-label={rIdx === 0 ? "S, M, L, XL" : "XS, UNICA, XXL"}>
                      {row.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={v.taglia === t ? "sizeBtn sizeBtn--active" : "sizeBtn"}
                          onPointerDown={() => {
                            lastTagliaRef.current = t;
                            updateVariante(idx, { taglia: t });
                          }}
                          onClick={() => {
                            lastTagliaRef.current = t;
                            updateVariante(idx, { taglia: t });
                          }}
                          onFocus={scrollFieldIntoView}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="variantRow__cell variantRow__box">
                <input
                  ref={(el) => {
                    boxRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  value={String(v.box ?? "")}
                  onChange={(e) => {
                    const val = e.target.value;
                    lastBoxRef.current = val;
                    updateVariante(idx, { box: val });
                  }}
                  onFocus={scrollFieldIntoView}
                  placeholder="Box"
                  aria-label="Box"
                />
              </div>

              <div className="variantRow__cell variantRow__quantita">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={v.quantita}
                  onChange={(e) => updateVarianteAutoAdd(idx, { quantita: e.target.value })}
                  onKeyDown={(e) => {
                    const goNext =
                      (e.key === "Tab" || e.key === "Enter") && !e.shiftKey && idx < form.varianti.length - 1;
                    if (goNext) {
                      e.preventDefault();
                      setTimeout(() => {
                        coloreRefs.current[idx + 1]?.focus();
                        variantRowRefs.current[idx + 1]?.scrollIntoView?.({ behavior: "smooth", block: "center" });
                      }, 0);
                    }
                  }}
                  onFocus={scrollFieldIntoView}
                  placeholder="Q.tà"
                  aria-label="Quantità"
                  required
                />
              </div>

              <div className="variantActions">
                <button type="button" className="btn btn--danger" onClick={() => setRemoveConfirmIdx(idx)}>
                  Rimuovi
                </button>
                <button className="btn btn--primary" type="submit" disabled={saving}>
                  {saving ? "Salvataggio..." : "Salva articolo"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </form>

      {removeConfirmIdx !== null ? (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-remove-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRemoveConfirmIdx(null);
          }}
        >
          <div className="modalCard">
            <div id="confirm-remove-title" className="sectionTitle">Elimina variante</div>
            <p className="modalConfirm__text">Sei sicuro di voler eliminare questa variante?</p>
            <div className="row row--end" style={{ gap: "10px", marginTop: "14px" }}>
              <button type="button" className="btn btn--ghost" onClick={() => setRemoveConfirmIdx(null)}>
                Annulla
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  removeVariante(removeConfirmIdx);
                  setRemoveConfirmIdx(null);
                }}
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

