import React, { useEffect, useState } from "react";
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

export default function ListaAcquistiPage() {
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState(null);
  const [gruppi, setGruppi] = useState([]);

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

  return (
    <div className="page">
      <div className="row row--between">
        <div>
          <div className="page__title">Lista acquisti</div>
          <div className="hint">Elenco non modificabile: per fornitore, colore, taglia, quantità e prezzo.</div>
        </div>
        <button className="btn btn--ghost" onClick={load} disabled={loading}>
          Aggiorna
        </button>
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
                <div className="listaAcquisti__thead">
                  <div className="listaAcquisti__th">Articolo</div>
                  <div className="listaAcquisti__th listaAcquisti__th--colore">Colore</div>
                  <div className="listaAcquisti__th listaAcquisti__th--center listaAcquisti__th--taglia">Taglia</div>
                  <div className="listaAcquisti__th listaAcquisti__th--num">Q.tà</div>
                  <div className="listaAcquisti__th listaAcquisti__th--num">Totale</div>
                </div>
                {sortRighe(g.righe).map((r, idx) => {
                  const qty = Number(r.quantita) >= 0 ? Number(r.quantita) : 0;
                  const prezzo = Number(r.prezzo) || 0;
                  const totaleRiga = prezzo * qty;
                  return (
                    <div key={`${r.codice_articolo}-${r.colore}-${r.taglia}-${idx}`} className="listaAcquisti__tr">
                      <div className="listaAcquisti__td listaAcquisti__td--code">{r.codice_articolo || "—"}</div>
                      <div className="listaAcquisti__td listaAcquisti__td--colore">{coloreSuDueRighe(r.colore)}</div>
                      <div className="listaAcquisti__td listaAcquisti__td--center listaAcquisti__td--taglia">{capitalize(r.taglia) || "—"}</div>
                      <div className="listaAcquisti__td listaAcquisti__td--num">{qty}</div>
                      <div className="listaAcquisti__td listaAcquisti__td--num listaAcquisti__td--totale">{euro(totaleRiga)}</div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
