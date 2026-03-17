import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

function euro(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function onlyNumber(n) {
  return Number(n) || 0;
}

export default function ArticoliPerFornitorePage() {
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState(null);
  const [gruppi, setGruppi] = useState([]);
  const [open, setOpen] = useState(() => new Set());
  const [variantiCache, setVariantiCache] = useState(() => new Map());
  const [variantiLoading, setVariantiLoading] = useState(() => new Set());
  const [confirmDeleteFornitore, setConfirmDeleteFornitore] = useState(null);
  const [confirmDeleteArticolo, setConfirmDeleteArticolo] = useState(null);
  const [confirmDeleteVariante, setConfirmDeleteVariante] = useState(null);
  const [editingVariante, setEditingVariante] = useState(null);
  const [editingArticolo, setEditingArticolo] = useState(null);
  const [showColonne, setShowColonne] = useState(false);
  const [colonneVisibili, setColonneVisibili] = useState(() => {
    try {
      const raw = localStorage.getItem("articoli_colonneVisibili_v1");
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (e) {}
    return ["foto", "articolo", "prodotto", "prezzo", "quantita", "valore"];
  });

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem("articoli_colonneVisibili_v1", JSON.stringify(colonneVisibili));
      } catch (e) {}
    }, 200);
    return () => clearTimeout(id);
  }, [colonneVisibili]);

  async function load() {
    setLoading(true);
    setErrore(null);
    try {
      const data = await api.articoliRaggruppati();
      setGruppi(data.gruppi || []);
    } catch (err) {
      setErrore(err.message || "Errore nel caricamento");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totaliGlobali = useMemo(() => {
    let articoli = 0;
    let quantita = 0;
    let valore = 0;
    for (const g of gruppi) {
      articoli += onlyNumber(g.totali?.articoli);
      quantita += onlyNumber(g.totali?.quantita);
      valore += onlyNumber(g.totali?.valore);
    }
    return { articoli, quantita, valore };
  }, [gruppi]);

  const colonne = useMemo(
    () => [
      { key: "foto", label: "Foto", width: "var(--le-w-foto)" },
      { key: "articolo", label: "Articolo", width: "var(--le-w-articolo)" },
      { key: "prodotto", label: "Prodotto", width: "var(--le-w-prodotto)" },
      { key: "prezzo", label: "Prezzo", width: "var(--le-w-prezzo)" },
      { key: "quantita", label: "Q.tà", width: "var(--le-w-quantita)" },
      { key: "valore", label: "Valore", width: "var(--le-w-valore)" }
    ],
    []
  );

  const isVisible = (key) => colonneVisibili.includes(key);
  const gridTemplateColumns = useMemo(
    () => colonne.filter((c) => isVisible(c.key)).map((c) => c.width).join(" "),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colonneVisibili]
  );

  function toggleColonna(key) {
    setColonneVisibili((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function toggleFornitore(fornitore) {
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(fornitore)) next.delete(fornitore);
      else next.add(fornitore);
      return next;
    });
  }

  async function ensureVarianti(articoloId) {
    if (variantiCache.has(articoloId)) return;
    if (variantiLoading.has(articoloId)) return;

    setVariantiLoading((s) => new Set(s).add(articoloId));
    try {
      const data = await api.variantiArticolo(articoloId);
      setVariantiCache((m) => new Map(m).set(articoloId, data.varianti || []));
    } finally {
      setVariantiLoading((s) => {
        const next = new Set(s);
        next.delete(articoloId);
        return next;
      });
    }
  }

  useEffect(() => {
    // Quando apro un fornitore, carico automaticamente le varianti degli articoli mostrati.
    for (const g of gruppi) {
      if (!open.has(g.fornitore)) continue;
      for (const a of g.articoli) ensureVarianti(a.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gruppi]);

  async function handleEliminaFornitore() {
    if (!confirmDeleteFornitore) return;
    try {
      await api.eliminaFornitore(confirmDeleteFornitore);
      setConfirmDeleteFornitore(null);
      setOpen((s) => {
        const next = new Set(s);
        next.delete(confirmDeleteFornitore);
        return next;
      });
      await load();
    } catch (err) {
      setErrore(err.message || "Errore nell'eliminazione");
    }
  }

  async function handleEliminaArticolo() {
    if (!confirmDeleteArticolo) return;
    try {
      await api.eliminaArticolo(confirmDeleteArticolo.id);
      setVariantiCache((m) => {
        const next = new Map(m);
        next.delete(confirmDeleteArticolo.id);
        return next;
      });
      setConfirmDeleteArticolo(null);
      await load();
    } catch (err) {
      setErrore(err.message || "Errore nell'eliminazione articolo");
    }
  }

  async function handleEliminaVariante() {
    if (!confirmDeleteVariante) return;
    try {
      await api.eliminaVariante(confirmDeleteVariante.varianteId);
      setVariantiCache((m) => {
        const list = m.get(confirmDeleteVariante.articoloId) || [];
        const next = new Map(m);
        next.set(
          confirmDeleteVariante.articoloId,
          list.filter((v) => v.id !== confirmDeleteVariante.varianteId)
        );
        return next;
      });
      setConfirmDeleteVariante(null);
      await load();
    } catch (err) {
      setErrore(err.message || "Errore nell'eliminazione variante");
    }
  }

  function startEditVariante(v, articoloId) {
    setEditingVariante({
      id: v.id,
      articoloId,
      colore: v.colore ?? "",
      taglia: v.taglia ?? "",
      quantita: v.quantita ?? 0,
      box: v.box !== undefined && v.box !== null ? String(v.box) : ""
    });
  }

  async function handleSalvaVariante() {
    if (!editingVariante) return;
    try {
      await api.aggiornaVariante(editingVariante.id, {
        colore: editingVariante.colore,
        taglia: editingVariante.taglia,
        quantita: Number(editingVariante.quantita) || 0,
        box: editingVariante.box === "" ? 0 : Number(editingVariante.box) || 0
      });
      setVariantiCache((m) => {
        const list = m.get(editingVariante.articoloId) || [];
        const next = new Map(m);
        next.set(editingVariante.articoloId, [
          ...list.filter((x) => x.id !== editingVariante.id),
          {
            id: editingVariante.id,
            articolo_id: editingVariante.articoloId,
            colore: editingVariante.colore,
            taglia: editingVariante.taglia,
            quantita: Number(editingVariante.quantita) || 0,
            box: editingVariante.box === "" ? 0 : Number(editingVariante.box) || 0
          }
        ]);
        return next;
      });
      setEditingVariante(null);
      await load();
    } catch (err) {
      setErrore(err.message || "Errore nel salvataggio variante");
    }
  }

  function startEditArticolo(a) {
    setEditingArticolo({
      id: a.id,
      codice_articolo: a.codice_articolo ?? "",
      descrizione: a.descrizione ?? "",
      prezzo: a.prezzo != null ? String(a.prezzo) : "0"
    });
  }

  async function handleSalvaArticolo() {
    if (!editingArticolo) return;
    try {
      await api.aggiornaArticolo(editingArticolo.id, {
        codice_articolo: editingArticolo.codice_articolo.trim(),
        descrizione: editingArticolo.descrizione.trim(),
        prezzo: Number(editingArticolo.prezzo) || 0
      });
      setEditingArticolo(null);
      await load();
    } catch (err) {
      setErrore(err.message || "Errore nel salvataggio articolo");
    }
  }

  function downloadExport() {
    const a = document.createElement("a");
    a.href = "/api/export/solo-valori.csv";
    a.download = "report_solo_valori.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="page">
      <div className="row row--between">
        <div>
          <div className="page__title">Articoli raggruppati per fornitore</div>
          <div className="hint">
            Totali globali: <b>{totaliGlobali.articoli}</b> articoli, <b>{totaliGlobali.quantita}</b> pezzi,{" "}
            <b>{euro(totaliGlobali.valore)}</b>
          </div>
        </div>
        <div className="row">
          <button className="btn btn--ghost" type="button" onClick={() => setShowColonne(true)}>
            Colonne
          </button>
          <button className="btn btn--ghost" onClick={load} disabled={loading}>
            Aggiorna
          </button>
          <button className="btn btn--primary" onClick={downloadExport}>
            Export (solo valori)
          </button>
        </div>
      </div>

      {errore ? <div className="alert alert--error">{errore}</div> : null}
      {loading ? <div className="card">Caricamento...</div> : null}

      {!loading && gruppi.length === 0 ? <div className="card">Nessun articolo presente.</div> : null}

      <div className="listExcel">
        {gruppi.map((g) => {
          const isOpen = open.has(g.fornitore);
          return (
            <div key={g.fornitore} className="listExcel__block">
              <div className="listExcel__headerRow">
                <button className="listExcel__header" type="button" onClick={() => toggleFornitore(g.fornitore)}>
                  <span className="listExcel__fornitore">
                    {g.fornitore}
                    {g.articoli?.[0]?.cliente ? (
                      <span className="listExcel__cliente"> · {g.articoli[0].cliente}</span>
                    ) : null}
                  </span>
                  <span className="listExcel__totals">
                    {g.totali.articoli} art · {g.totali.quantita} pz · {euro(g.totali.valore)}
                  </span>
                  <span className="listExcel__toggle">{isOpen ? "▼" : "▶"}</span>
                </button>
                <button
                  type="button"
                  className="btn btn--danger listExcel__btnIcon listExcel__btnRemoveFornitore"
                  title="Elimina tutti gli articoli di questo fornitore"
                  aria-label="Rimuovi fornitore"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteFornitore(g.fornitore);
                  }}
                >
                  <svg className="listExcel__icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </div>

              {isOpen ? (
                <div className="listExcel__body">
                  <div className="listExcel__table">
                    <div className="listExcel__thead" style={{ gridTemplateColumns }}>
                      {isVisible("foto") ? <div className="listExcel__th listExcel__th--img" /> : null}
                      {isVisible("articolo") ? <div className="listExcel__th">Articolo</div> : null}
                      {isVisible("prodotto") ? <div className="listExcel__th">Prodotto</div> : null}
                      {isVisible("prezzo") ? <div className="listExcel__th listExcel__th--num">Prezzo</div> : null}
                      {isVisible("quantita") ? <div className="listExcel__th listExcel__th--num">Q.tà</div> : null}
                      {isVisible("valore") ? <div className="listExcel__th listExcel__th--num">Valore</div> : null}
                    </div>
                    {g.articoli.map((a) => {
                      const varianti = variantiCache.get(a.id) || null;
                      const isVarLoading = variantiLoading.has(a.id);
                      const valore = onlyNumber(a.prezzo) * onlyNumber(a.quantita_totale);
                      return (
                        <React.Fragment key={a.id}>
                          <div className="listExcel__tr" style={{ gridTemplateColumns }}>
                            {isVisible("foto") ? (
                              <div className="listExcel__td listExcel__td--img">
                                <div className="listExcel__imgBlock">
                                  {a.foto_data_url ? (
                                    <img className="listExcel__thumb" src={a.foto_data_url} alt="" />
                                  ) : (
                                    <span className="listExcel__noimg">—</span>
                                  )}
                                  <button
                                    type="button"
                                    className="listExcel__btnModificaArticolo"
                                    title="Modifica articolo"
                                    aria-label="Modifica articolo"
                                    onClick={() => startEditArticolo(a)}
                                  >
                                    <svg className="listExcel__icon listExcel__icon--pen" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                      <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ) : null}

                            {isVisible("articolo") ? <div className="listExcel__td listExcel__td--code">{a.codice_articolo}</div> : null}
                            {isVisible("prodotto") ? <div className="listExcel__td listExcel__td--desc">{a.descrizione || "—"}</div> : null}
                            {isVisible("prezzo") ? <div className="listExcel__td listExcel__td--num">{euro(a.prezzo)}</div> : null}
                            {isVisible("quantita") ? <div className="listExcel__td listExcel__td--num">{a.quantita_totale}</div> : null}
                            {isVisible("valore") ? (
                              <div className="listExcel__td listExcel__td--num listExcel__td--value listExcel__td--valueWithDelete">
                                <span className="listExcel__valueText">{euro(valore)}</span>
                                <button
                                  type="button"
                                  className="listExcel__btnEliminaArticolo"
                                  title="Elimina articolo"
                                  aria-label="Elimina articolo"
                                  onClick={() => setConfirmDeleteArticolo({ id: a.id, codice_articolo: a.codice_articolo })}
                                >
                                  <svg className="listExcel__icon listExcel__icon--trash" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                    <line x1="10" y1="11" x2="10" y2="17" />
                                    <line x1="14" y1="11" x2="14" y2="17" />
                                  </svg>
                                </button>
                              </div>
                            ) : null}
                          </div>
                          <div className="listExcel__varianti">
                            <div className="listExcel__vHead">
                              <span className="listExcel__vHeadAction" />
                              <span>Colore</span>
                              <span>Taglia</span>
                              <span>Q.tà</span>
                              <span>Box</span>
                              <span />
                            </div>
                            {isVarLoading || varianti === null ? (
                              <div className="listExcel__vRow listExcel__vRow--empty">Caricamento...</div>
                            ) : varianti.length === 0 ? (
                              <div className="listExcel__vRow listExcel__vRow--empty">—</div>
                            ) : (
                              varianti.map((v) => (
                                <div key={v.id} className="listExcel__vRow">
                                  <button type="button" className="listExcel__vRowBtn listExcel__vRowBtn--first listExcel__btnIcon" title="Modifica" aria-label="Modifica" onClick={() => startEditVariante(v, a.id)}>
                                    <svg className="listExcel__icon listExcel__icon--pen" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                      <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                  </button>
                                  <span>{v.colore}</span>
                                  <span>{v.taglia}</span>
                                  <span>{v.quantita}</span>
                                  <span>{v.box ?? ""}</span>
                                  <button
                                    type="button"
                                    className="listExcel__vRowRemove listExcel__btnIcon"
                                    title="Elimina variante"
                                    aria-label="Rimuovi variante"
                                    onClick={() => setConfirmDeleteVariante({ varianteId: v.id, articoloId: a.id })}
                                  >
                                    <svg className="listExcel__icon listExcel__icon--trash" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                      <line x1="10" y1="11" x2="10" y2="17" />
                                      <line x1="14" y1="11" x2="14" y2="17" />
                                    </svg>
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {showColonne ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && setShowColonne(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="sectionTitle">Colonne visibili</div>
            <div className="modalList" style={{ maxHeight: "unset" }}>
              {colonne.map((c) => (
                <label key={c.key} className="modalItem" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={isVisible(c.key)} onChange={() => toggleColonna(c.key)} />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
            <div className="row row--end" style={{ gap: "10px", marginTop: "14px" }}>
              <button type="button" className="btn btn--ghost" onClick={() => setShowColonne(false)}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDeleteFornitore !== null ? (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setConfirmDeleteFornitore(null)}
        >
          <div className="modalCard">
            <div className="sectionTitle">Elimina fornitore</div>
            <p className="modalConfirm__text">
              Eliminare tutti gli articoli del fornitore <strong>{confirmDeleteFornitore}</strong>? Questa azione non
              si può annullare.
            </p>
            <div className="row row--end" style={{ gap: "10px", marginTop: "14px" }}>
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmDeleteFornitore(null)}>
                Annulla
              </button>
              <button type="button" className="btn btn--danger" onClick={handleEliminaFornitore}>
                Elimina tutto
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDeleteArticolo !== null ? (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setConfirmDeleteArticolo(null)}
        >
          <div className="modalCard">
            <div className="sectionTitle">Elimina articolo</div>
            <p className="modalConfirm__text">
              Eliminare l&apos;articolo <strong>{confirmDeleteArticolo.codice_articolo}</strong> e tutte le sue varianti?
              Questa azione non si può annullare.
            </p>
            <div className="row row--end" style={{ gap: "10px", marginTop: "14px" }}>
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmDeleteArticolo(null)}>
                Annulla
              </button>
              <button type="button" className="btn btn--danger" onClick={handleEliminaArticolo}>
                Elimina articolo
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDeleteVariante !== null ? (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setConfirmDeleteVariante(null)}
        >
          <div className="modalCard">
            <div className="sectionTitle">Elimina variante</div>
            <p className="modalConfirm__text">Eliminare questa variante (colore/taglia/quantità)?</p>
            <div className="row row--end" style={{ gap: "10px", marginTop: "14px" }}>
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmDeleteVariante(null)}>
                Annulla
              </button>
              <button type="button" className="btn btn--danger" onClick={handleEliminaVariante}>
                Elimina
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingArticolo !== null ? (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setEditingArticolo(null)}
        >
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="sectionTitle">Modifica articolo</div>
            <div className="grid grid--2" style={{ marginTop: "12px" }}>
              <label className="field">
                <div className="field__label">Articolo</div>
                <input
                  value={editingArticolo.codice_articolo}
                  onChange={(e) => setEditingArticolo((x) => ({ ...x, codice_articolo: e.target.value }))}
                  placeholder="Es. ART-001"
                />
              </label>
              <label className="field">
                <div className="field__label">Prodotto</div>
                <input
                  value={editingArticolo.descrizione}
                  onChange={(e) => setEditingArticolo((x) => ({ ...x, descrizione: e.target.value }))}
                />
              </label>
              <label className="field field--full">
                <div className="field__label">Prezzo (EUR)</div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingArticolo.prezzo}
                  onChange={(e) => setEditingArticolo((x) => ({ ...x, prezzo: e.target.value }))}
                />
              </label>
            </div>
            <div className="row row--end" style={{ gap: "10px", marginTop: "14px" }}>
              <button type="button" className="btn btn--ghost" onClick={() => setEditingArticolo(null)}>
                Annulla
              </button>
              <button type="button" className="btn btn--primary" onClick={handleSalvaArticolo}>
                Salva
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingVariante !== null ? (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setEditingVariante(null)}
        >
          <div className="modalCard modalCard--scroll" onClick={(e) => e.stopPropagation()}>
            <div className="sectionTitle">Modifica variante</div>
            <div className="grid grid--2" style={{ marginTop: "12px" }}>
              <label className="field">
                <div className="field__label">Colore</div>
                <input
                  value={editingVariante.colore}
                  onChange={(e) => setEditingVariante((x) => ({ ...x, colore: e.target.value }))}
                  placeholder="Colore"
                />
              </label>
              <label className="field">
                <div className="field__label">Taglia</div>
                <input
                  value={editingVariante.taglia}
                  onChange={(e) => setEditingVariante((x) => ({ ...x, taglia: e.target.value }))}
                  placeholder="Taglia"
                />
              </label>
              <label className="field">
                <div className="field__label">Quantità</div>
                <input
                  type="number"
                  min="0"
                  value={editingVariante.quantita}
                  onChange={(e) => setEditingVariante((x) => ({ ...x, quantita: e.target.value }))}
                />
              </label>
              <label className="field">
                <div className="field__label">Box</div>
                <input
                  value={editingVariante.box}
                  onChange={(e) => setEditingVariante((x) => ({ ...x, box: e.target.value }))}
                  placeholder="Box"
                />
              </label>
            </div>
            <div className="row row--end" style={{ gap: "10px", marginTop: "14px" }}>
              <button type="button" className="btn btn--ghost" onClick={() => setEditingVariante(null)}>
                Annulla
              </button>
              <button type="button" className="btn btn--primary" onClick={handleSalvaVariante}>
                Salva
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

