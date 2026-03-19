import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

function euro(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function capitalize(str) {
  if (str == null || str === "") return str;
  const s = String(str).trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Colore con a capo allo spazio: "Benetton green" → "Benetton" + "green" su due righe */
function coloreSuDueRighe(str) {
  if (str == null || str === "") return "—";
  const s = String(str).trim();
  return s
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("\n");
}

function sortRighe(righe) {
  return [...(righe || [])].sort((a, b) => {
    const c = (a.codice_articolo || "").localeCompare(b.codice_articolo || "", undefined, { sensitivity: "base" });
    if (c !== 0) return c;
    const d = (a.colore || "").localeCompare(b.colore || "", undefined, { sensitivity: "base" });
    if (d !== 0) return d;
    return (a.taglia || "").localeCompare(b.taglia || "", undefined, { sensitivity: "base" });
  });
}

const STORAGE_KEY_COLONNE = "listaAcquisti_colonneVisibili_v1";

export default function ListaAcquistiPage() {
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState(null);
  const [gruppi, setGruppi] = useState([]);
  const [showColonne, setShowColonne] = useState(false);
  const [colonneVisibili, setColonneVisibili] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_COLONNE);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (e) {}
    return ["foto", "articolo", "colore", "taglia", "quantita", "prezzo", "totale"];
  });

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY_COLONNE, JSON.stringify(colonneVisibili));
      } catch (e) {}
    }, 200);
    return () => clearTimeout(id);
  }, [colonneVisibili]);

  async function load() {
    setLoading(true);
    setErrore(null);
    try {
      const data = await api.listaAcquisti();
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

  const colonne = useMemo(
    () => [
      { key: "foto", label: "Foto", width: "var(--la-w-foto)" },
      { key: "articolo", label: "Articolo", width: "var(--la-w-articolo)" },
      { key: "prodotto", label: "Prodotto", width: "var(--la-w-prodotto)" },
      { key: "colore", label: "Colore", width: "var(--la-w-colore)" },
      { key: "taglia", label: "Taglia", width: "var(--la-w-taglia)" },
      { key: "quantita", label: "Q.tà", width: "var(--la-w-quantita)" },
      { key: "prezzo", label: "Prezzo", width: "var(--la-w-prezzo)" },
      { key: "totale", label: "Totale", width: "var(--la-w-totale)" }
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

  return (
    <div className="page">
      <div className="row row--between">
        <div>
          <div className="page__title">Lista acquisti</div>
          <div className="hint">Elenco non modificabile: per fornitore, colore, taglia, quantità e prezzo.</div>
        </div>
        <div className="row">
          <button className="btn btn--ghost" type="button" onClick={() => setShowColonne(true)}>
            Colonne
          </button>
          <button className="btn btn--ghost" onClick={load} disabled={loading}>
            Aggiorna
          </button>
        </div>
      </div>

      {errore ? <div className="alert alert--error">{errore}</div> : null}

      {loading ? (
        <div className="card">Caricamento...</div>
      ) : gruppi.length === 0 ? (
        <div className="card">Nessun acquisto presente.</div>
      ) : (
        <div className="listaAcquisti">
          {gruppi.map((g) => (
            <div key={g.fornitore} className="listaAcquisti__block">
              <div className="listaAcquisti__header">
                <span className="listaAcquisti__nome">{g.fornitore}</span>
                <span className="listaAcquisti__totale">{euro(g.totale)}</span>
              </div>
              <div className="listaAcquisti__tableWrap">
                <div className="listaAcquisti__table">
                <div className="listaAcquisti__thead" style={{ gridTemplateColumns }}>
                  {isVisible("foto") ? <div className="listaAcquisti__th listaAcquisti__th--img" /> : null}
                  {isVisible("articolo") ? <div className="listaAcquisti__th">Articolo</div> : null}
                  {isVisible("prodotto") ? <div className="listaAcquisti__th">Prodotto</div> : null}
                  {isVisible("colore") ? <div className="listaAcquisti__th listaAcquisti__th--colore">Colore</div> : null}
                  {isVisible("taglia") ? <div className="listaAcquisti__th listaAcquisti__th--center listaAcquisti__th--taglia">Taglia</div> : null}
                  {isVisible("quantita") ? <div className="listaAcquisti__th listaAcquisti__th--num">Q.tà</div> : null}
                  {isVisible("prezzo") ? <div className="listaAcquisti__th listaAcquisti__th--num">Prezzo</div> : null}
                  {isVisible("totale") ? <div className="listaAcquisti__th listaAcquisti__th--num">Totale</div> : null}
                </div>
                {sortRighe(g.righe).map((r, idx) => {
                  const qty = Number(r.quantita) >= 0 ? Number(r.quantita) : 0;
                  const prezzo = Number(r.prezzo) || 0;
                  const totaleRiga = prezzo * qty;
                  return (
                    <div key={`${r.codice_articolo}-${r.colore}-${r.taglia}-${idx}`} className="listaAcquisti__tr" style={{ gridTemplateColumns }}>
                      {isVisible("foto") ? (
                        <div className="listaAcquisti__td listaAcquisti__td--img">
                          {r.foto_data_url ? <img className="listaAcquisti__thumb" src={r.foto_data_url} alt="" /> : <span className="listaAcquisti__noimg">—</span>}
                        </div>
                      ) : null}
                      {isVisible("articolo") ? <div className="listaAcquisti__td listaAcquisti__td--code">{r.codice_articolo || "—"}</div> : null}
                      {isVisible("prodotto") ? <div className="listaAcquisti__td">{r.prodotto || "—"}</div> : null}
                      {isVisible("colore") ? <div className="listaAcquisti__td listaAcquisti__td--colore">{coloreSuDueRighe(r.colore)}</div> : null}
                      {isVisible("taglia") ? (
                        <div className="listaAcquisti__td listaAcquisti__td--center listaAcquisti__td--taglia">{capitalize(r.taglia) || "—"}</div>
                      ) : null}
                      {isVisible("quantita") ? <div className="listaAcquisti__td listaAcquisti__td--num">{qty}</div> : null}
                      {isVisible("prezzo") ? <div className="listaAcquisti__td listaAcquisti__td--num listaAcquisti__td--prezzo">{euro(prezzo)}</div> : null}
                      {isVisible("totale") ? <div className="listaAcquisti__td listaAcquisti__td--num listaAcquisti__td--totale">{euro(totaleRiga)}</div> : null}
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
}
