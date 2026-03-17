import { supabase } from "./supabase.js";
import {
  loadArticoliGruppi,
  loadListaAcquistiGruppi,
  outboxAdd,
  outboxListPending,
  outboxMarkDone,
  outboxMarkFailed,
  saveArticoliGruppi,
  saveListaAcquistiGruppi
} from "./dbDexie.js";

// Mappa campi Supabase ↔ app (articoli: art ↔ codice_articolo, foto_url ↔ foto_data_url; varianti: ref_articolo ↔ articolo_id)
function toAppArticolo(row) {
  if (!row) return null;
  return {
    id: row.id,
    codice_articolo: row.art,
    descrizione: row.descrizione ?? "",
    composizione: row.composizione ?? "",
    prezzo: Number(row.prezzo) ?? 0,
    foto_data_url: row.foto_url ?? null,
    fornitore: row.fornitore ?? "",
    cliente: row.cliente ?? "",
    quantita_totale: row.quantita_totale ?? 0,
    created_at: row.created_at
  };
}

function toSupabaseArticolo(payload) {
  return {
    art: payload.codice_articolo ?? payload.art ?? "",
    descrizione: payload.descrizione ?? "",
    composizione: payload.composizione ?? "",
    prezzo: Number(payload.prezzo) ?? 0,
    foto_url: payload.foto_data_url ?? payload.foto_url ?? null,
    fornitore: payload.fornitore ?? "",
    cliente: payload.cliente ?? ""
  };
}

function toAppVariante(row) {
  if (!row) return null;
  return {
    id: row.id,
    articolo_id: row.ref_articolo,
    colore: row.colore ?? "",
    taglia: row.taglia ?? "",
    quantita: Number(row.quantita) ?? 0,
    box: row.box != null && row.box !== "" ? String(row.box) : ""
  };
}

function toSupabaseVariante(v, ref_articolo, prezzo = 0) {
  const quantita = Number(v.quantita) ?? 0;
  return {
    ref_articolo,
    colore: String(v.colore ?? "").trim(),
    taglia: String(v.taglia ?? "").trim(),
    quantita,
    totale: Number(prezzo) * quantita,
    box: v.box != null && v.box !== "" ? String(v.box) : ""
  };
}

function handleError(err) {
  const msg = err?.message ?? String(err);
  const e = new Error(msg);
  e.details = err;
  throw e;
}

export const api = {
  async syncOutbox() {
    const pending = await outboxListPending(50);
    for (const item of pending) {
      try {
        if (item.type === "creaArticolo") {
          await api._creaArticoloOnline(item.payload);
          await outboxMarkDone(item.id);
        } else {
          await outboxMarkFailed(item.id, "Tipo non supportato");
        }
      } catch (e) {
        await outboxMarkFailed(item.id, e?.message || String(e));
      }
    }
    return { ok: true };
  },

  health: async () => {
    const { error } = await supabase.from("articoli").select("id").limit(1);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async articoliRaggruppati() {
    try {
      const { data: articoliRows, error: e1 } = await supabase
        .from("articoli")
        .select("id, art, descrizione, composizione, prezzo, foto_url, fornitore, cliente, created_at")
        .order("fornitore")
        .order("art");
      if (e1) handleError(e1);

      const { data: variantiRows, error: e2 } = await supabase.from("varianti").select("ref_articolo, quantita");
      if (e2) handleError(e2);

      const sumByArticolo = new Map();
      for (const v of variantiRows || []) {
        const prev = sumByArticolo.get(v.ref_articolo) ?? 0;
        sumByArticolo.set(v.ref_articolo, prev + (Number(v.quantita) || 0));
      }

      const articoli = (articoliRows || []).map((r) => ({
        ...toAppArticolo(r),
        quantita_totale: sumByArticolo.get(r.id) ?? 0
      }));

      const gruppi = [];
      const byFornitore = new Map();
      for (const a of articoli) {
        const key = a.fornitore;
        if (!byFornitore.has(key)) {
          const g = { fornitore: key, articoli: [], totali: { articoli: 0, quantita: 0, valore: 0 } };
          byFornitore.set(key, g);
          gruppi.push(g);
        }
        const g = byFornitore.get(key);
        g.articoli.push(a);
        g.totali.articoli += 1;
        g.totali.quantita += a.quantita_totale;
        g.totali.valore += Number(a.prezzo) * a.quantita_totale;
      }

      await saveArticoliGruppi(gruppi);
      return { gruppi };
    } catch (e) {
      const gruppi = await loadArticoliGruppi();
      if (gruppi.length) return { gruppi };
      throw e;
    }
  },

  async variantiArticolo(articoloId) {
    const { data, error } = await supabase
      .from("varianti")
      .select("id, ref_articolo, colore, taglia, quantita, box, created_at")
      .eq("ref_articolo", articoloId)
      .order("colore")
      .order("taglia");
    if (error) handleError(error);
    const varianti = (data || []).map(toAppVariante);
    return { varianti };
  },

  async fornitori() {
    const { data: articoliRows, error: e1 } = await supabase
      .from("articoli")
      .select("id, fornitore, prezzo");
    if (e1) handleError(e1);
    const { data: variantiRows, error: e2 } = await supabase.from("varianti").select("ref_articolo, quantita");
    if (e2) handleError(e2);

    const quantitaByArt = new Map();
    for (const v of variantiRows || []) {
      quantitaByArt.set(v.ref_articolo, (quantitaByArt.get(v.ref_articolo) ?? 0) + (Number(v.quantita) || 0));
    }

    const byFornitore = new Map();
    for (const a of articoliRows || []) {
      const q = quantitaByArt.get(a.id) ?? 0;
      const valore = (Number(a.prezzo) || 0) * q;
      if (!byFornitore.has(a.fornitore)) {
        byFornitore.set(a.fornitore, { fornitore: a.fornitore, articoli: 0, quantita: 0, valore: 0 });
      }
      const g = byFornitore.get(a.fornitore);
      g.articoli += 1;
      g.quantita += q;
      g.valore += valore;
    }
    return { fornitori: Array.from(byFornitore.values()) };
  },

  async listaAcquisti() {
    try {
      const { data: articoliRows, error: e1 } = await supabase
        .from("articoli")
        .select("id, fornitore, art, prezzo, foto_url")
        .order("fornitore")
        .order("art");
      if (e1) handleError(e1);
      const artById = new Map(
        (articoliRows || []).map((a) => [
          a.id,
          { ...a, codice_articolo: a.art, foto_data_url: a.foto_url ?? null }
        ])
      );

      const { data: variantiRows, error: e2 } = await supabase
        .from("varianti")
        .select("ref_articolo, colore, taglia, quantita")
        .order("colore")
        .order("taglia");
      if (e2) handleError(e2);

      const gruppi = new Map();
      for (const v of variantiRows || []) {
        const a = artById.get(v.ref_articolo);
        if (!a) continue;
        if (!gruppi.has(a.fornitore)) {
          gruppi.set(a.fornitore, { fornitore: a.fornitore, totale: 0, righe: [] });
        }
        const g = gruppi.get(a.fornitore);
        const prezzo = Number(a.prezzo) || 0;
        const qty = Number(v.quantita) || 0;
        g.totale += prezzo * qty;
        g.righe.push({
          codice_articolo: a.codice_articolo ?? "",
          foto_data_url: a.foto_data_url ?? null,
          colore: v.colore ?? "",
          taglia: v.taglia ?? "",
          quantita: qty,
          prezzo
        });
      }

      const arr = Array.from(gruppi.values());
      await saveListaAcquistiGruppi(arr);
      return { gruppi: arr };
    } catch (e) {
      const gruppi = await loadListaAcquistiGruppi();
      if (gruppi.length) return { gruppi };
      throw e;
    }
  },

  async creaArticolo(payload) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await outboxAdd({ type: "creaArticolo", payload });
      return { ok: true, queued: true };
    }
    try {
      return await api._creaArticoloOnline(payload);
    } catch (e) {
      const msg = String(e?.message || e);
      if (/network|failed to fetch|fetch/i.test(msg)) {
        await outboxAdd({ type: "creaArticolo", payload });
        return { ok: true, queued: true };
      }
      throw e;
    }
  },

  async _creaArticoloOnline(payload) {
    const artRow = toSupabaseArticolo(payload);
    const { data: inserted, error: eArt } = await supabase.from("articoli").insert(artRow).select("id").single();
    if (eArt) {
      if (eArt.code === "23505") throw new Error("Codice articolo già esistente per questo fornitore");
      handleError(eArt);
    }
    const articoloId = inserted.id;
    const prezzo = Number(payload.prezzo) ?? 0;
    const varianti = (payload.varianti || []).map((v) => toSupabaseVariante(v, articoloId, prezzo));
    if (varianti.length) {
      const { error: eVar } = await supabase.from("varianti").insert(varianti);
      if (eVar) handleError(eVar);
    }
    return { ok: true, articolo_id: articoloId };
  },

  async aggiornaArticolo(id, payload) {
    const update = {};
    if (payload.codice_articolo !== undefined) update.art = String(payload.codice_articolo).trim();
    if (payload.descrizione !== undefined) update.descrizione = String(payload.descrizione).trim();
    if (typeof payload.prezzo === "number" && Number.isFinite(payload.prezzo))
      update.prezzo = payload.prezzo;
    if (Object.keys(update).length === 0) return { ok: true };
    const { error } = await supabase.from("articoli").update(update).eq("id", id);
    if (error) {
      if (error.code === "23505") throw new Error("Codice articolo già esistente per questo fornitore");
      handleError(error);
    }
    return { ok: true };
  },

  async eliminaArticolo(id) {
    const { error } = await supabase.from("articoli").delete().eq("id", id);
    if (error) handleError(error);
    return { ok: true };
  },

  async aggiornaVariante(id, payload) {
    const update = {};
    if (payload.colore !== undefined) update.colore = String(payload.colore).trim();
    if (payload.taglia !== undefined) update.taglia = String(payload.taglia).trim();
    if (typeof payload.quantita === "number" && Number.isFinite(payload.quantita)) update.quantita = payload.quantita;
    if (payload.box !== undefined) update.box = payload.box === "" ? "" : String(payload.box);
    if (payload.totale !== undefined) update.totale = Number(payload.totale);
    if (Object.keys(update).length === 0) return { ok: true };
    const { error } = await supabase.from("varianti").update(update).eq("id", id);
    if (error) handleError(error);
    return { ok: true };
  },

  async eliminaVariante(id) {
    const { error } = await supabase.from("varianti").delete().eq("id", id);
    if (error) handleError(error);
    return { ok: true };
  },

  async eliminaFornitore(fornitore) {
    const { data: ids, error: e1 } = await supabase.from("articoli").select("id").eq("fornitore", fornitore);
    if (e1) handleError(e1);
    const list = (ids || []).map((r) => r.id);
    if (list.length === 0) throw new Error("Nessun articolo per questo fornitore");
    const { error: e2 } = await supabase.from("articoli").delete().in("id", list);
    if (e2) handleError(e2);
    return { ok: true, eliminati: list.length };
  },

  // Preferenze (sostituisce localStorage)
  async getPreferenza(chiave) {
    const { data, error } = await supabase.from("preferenze").select("valore").eq("chiave", chiave).maybeSingle();
    if (error) return "";
    return (data?.valore ?? "") || "";
  },

  async setPreferenza(chiave, valore) {
    await supabase.from("preferenze").upsert({ chiave, valore: valore || "" }, { onConflict: "chiave" });
  }
};
