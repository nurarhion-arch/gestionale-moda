import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

function euro(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

export default function FornitoriPage() {
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState(null);
  const [rows, setRows] = useState([]);

  async function load() {
    setLoading(true);
    setErrore(null);
    try {
      const data = await api.fornitori();
      setRows(data.fornitori || []);
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
          <div className="page__title">Fornitori</div>
          <div className="hint">Elenco dei fornitori con valore totale, articoli e quantità.</div>
        </div>
        <button className="btn btn--ghost" onClick={load} disabled={loading}>
          Aggiorna
        </button>
      </div>

      {errore ? <div className="alert alert--error">{errore}</div> : null}

      <div className="card table">
        <div className="table__head">
          <div>Fornitore</div>
          <div>Articoli</div>
          <div>Quantità</div>
          <div>Valore totale</div>
        </div>
        {loading ? (
          <div className="table__row table__row--empty">Caricamento...</div>
        ) : rows.length === 0 ? (
          <div className="table__row table__row--empty">Nessun fornitore presente.</div>
        ) : (
          rows.map((r) => (
            <div key={r.fornitore} className="table__row">
              <div>{r.fornitore}</div>
              <div>{r.articoli}</div>
              <div>{r.quantita}</div>
              <div className="chip chip--value">{euro(r.valore)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

