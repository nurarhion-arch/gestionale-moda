import Dexie from "dexie";

const db = new Dexie("gestionale_moda_db");

db.version(2).stores({
  articoli: "id, fornitore, cliente",
  varianti: "id, articolo_id",
  articoliGruppi: "key",
  listaAcquistiGruppi: "key"
});

db.version(3).stores({
  articoli: "id, fornitore, cliente",
  varianti: "id, articolo_id",
  articoliGruppi: "key",
  listaAcquistiGruppi: "key",
  outbox: "++id, type, status, created_at"
});

export async function saveArticoliGruppi(gruppi) {
  try {
    await db.articoliGruppi.put({ key: "articoliPerFornitore", gruppi });
  } catch (e) {
    // ignore offline cache errors
  }
}

export async function loadArticoliGruppi() {
  try {
    const row = await db.articoliGruppi.get("articoliPerFornitore");
    return row?.gruppi || [];
  } catch (e) {
    return [];
  }
}

export async function saveListaAcquistiGruppi(gruppi) {
  try {
    await db.listaAcquistiGruppi.put({ key: "listaAcquisti", gruppi });
  } catch (e) {
    // ignore offline cache errors
  }
}

export async function loadListaAcquistiGruppi() {
  try {
    const row = await db.listaAcquistiGruppi.get("listaAcquisti");
    return row?.gruppi || [];
  } catch (e) {
    return [];
  }
}

export async function outboxAdd(item) {
  try {
    return await db.outbox.add({ ...item, status: "pending", created_at: Date.now() });
  } catch (e) {
    return null;
  }
}

export async function outboxListPending(limit = 50) {
  try {
    const list = await db.outbox.where("status").equals("pending").sortBy("created_at");
    return list.slice(0, limit);
  } catch (e) {
    return [];
  }
}

export async function outboxMarkDone(id) {
  try {
    await db.outbox.update(id, { status: "done", done_at: Date.now() });
  } catch (e) {}
}

export async function outboxMarkFailed(id, message) {
  try {
    await db.outbox.update(id, { status: "failed", last_error: String(message || ""), failed_at: Date.now() });
  } catch (e) {}
}

export { db };

