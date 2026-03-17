import express from "express";
import cors from "cors";
import { db, migrate } from "./db.js";
import { createArticoloSchema } from "./validation.js";
import { toCsv } from "./csv.js";

migrate();

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/articoli", (req, res) => {
  const parsed = createArticoloSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dati non validi", dettagli: parsed.error.flatten() });
  }

  const a = parsed.data;

  try {
    const insert = db.transaction(() => {
      const artStmt = db.prepare(`
        INSERT INTO articoli
          (codice_articolo, descrizione, composizione, prezzo, foto_data_url, fornitore, cliente)
        VALUES
          (@codice_articolo, @descrizione, @composizione, @prezzo, @foto_data_url, @fornitore, @cliente)
      `);
      const info = artStmt.run({
        codice_articolo: a.codice_articolo,
        descrizione: a.descrizione ?? "",
        composizione: a.composizione ?? "",
        prezzo: a.prezzo,
        foto_data_url: a.foto_data_url ?? null,
        fornitore: a.fornitore ?? "",
        cliente: a.cliente ?? ""
      });

      const articoloId = Number(info.lastInsertRowid);
      const varStmt = db.prepare(`
        INSERT INTO varianti (articolo_id, colore, taglia, quantita, box)
        VALUES (@articolo_id, @colore, @taglia, @quantita, @box)
      `);
      for (const v of a.varianti) {
        varStmt.run({
          articolo_id: articoloId,
          colore: v.colore,
          taglia: v.taglia,
          quantita: v.quantita,
          box: v.box ?? 0
        });
      }
      return articoloId;
    });

    const articoloId = insert();
    return res.status(201).json({ ok: true, articolo_id: articoloId });
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (msg.includes("UNIQUE") && (msg.includes("codice_articolo") || msg.includes("fornitore"))) {
      return res.status(409).json({ error: "Codice articolo già esistente per questo fornitore" });
    }
    return res.status(500).json({ error: "Errore interno", dettagli: msg });
  }
});

app.get("/api/articoli-raggruppati", (_req, res) => {
  const articoli = db
    .prepare(
      `
      SELECT
        a.id,
        a.codice_articolo,
        a.descrizione,
        a.composizione,
        a.prezzo,
        a.foto_data_url,
        a.fornitore,
        a.cliente,
        IFNULL(SUM(v.quantita), 0) AS quantita_totale
      FROM articoli a
      LEFT JOIN varianti v ON v.articolo_id = a.id
      GROUP BY a.id
      ORDER BY a.fornitore COLLATE NOCASE ASC, a.codice_articolo COLLATE NOCASE ASC
    `
    )
    .all();

  const grouped = new Map();
  for (const a of articoli) {
    const key = a.fornitore;
    if (!grouped.has(key)) grouped.set(key, { fornitore: key, articoli: [], totali: { articoli: 0, quantita: 0, valore: 0 } });
    const g = grouped.get(key);
    g.articoli.push(a);
    g.totali.articoli += 1;
    g.totali.quantita += Number(a.quantita_totale);
    g.totali.valore += Number(a.prezzo) * Number(a.quantita_totale);
  }

  res.json({ gruppi: Array.from(grouped.values()) });
});

app.get("/api/articoli/:id/varianti", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "ID non valido" });
  const varianti = db
    .prepare(
      `
      SELECT id, articolo_id, colore, taglia, quantita, box
      FROM varianti
      WHERE articolo_id = ?
      ORDER BY colore COLLATE NOCASE ASC, taglia COLLATE NOCASE ASC
    `
    )
    .all(id);
  res.json({ varianti });
});

app.patch("/api/articoli/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "ID articolo non valido" });
  const { codice_articolo, descrizione, prezzo } = req.body || {};
  try {
    const row = db.prepare("SELECT id, fornitore FROM articoli WHERE id = ?").get(id);
    if (!row) return res.status(404).json({ error: "Articolo non trovato" });
    if (codice_articolo !== undefined) {
      const code = String(codice_articolo).trim();
      const existing = db.prepare("SELECT id FROM articoli WHERE fornitore = ? AND codice_articolo = ? AND id != ?").get(row.fornitore, code, id);
      if (existing) return res.status(409).json({ error: "Codice articolo già esistente per questo fornitore" });
      db.prepare("UPDATE articoli SET codice_articolo = ? WHERE id = ?").run(code, id);
    }
    if (descrizione !== undefined) db.prepare("UPDATE articoli SET descrizione = ? WHERE id = ?").run(String(descrizione).trim(), id);
    if (typeof prezzo === "number" && Number.isFinite(prezzo) && prezzo >= 0)
      db.prepare("UPDATE articoli SET prezzo = ? WHERE id = ?").run(prezzo, id);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Errore interno", dettagli: String(e?.message ?? e) });
  }
});

app.delete("/api/articoli/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "ID articolo non valido" });
  try {
    const row = db.prepare("SELECT id FROM articoli WHERE id = ?").get(id);
    if (!row) return res.status(404).json({ error: "Articolo non trovato" });
    db.transaction(() => {
      db.prepare("DELETE FROM varianti WHERE articolo_id = ?").run(id);
      db.prepare("DELETE FROM articoli WHERE id = ?").run(id);
    })();
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Errore interno", dettagli: String(e?.message ?? e) });
  }
});

app.delete("/api/fornitori/:fornitore", (req, res) => {
  const fornitore = decodeURIComponent(req.params.fornitore || "");
  if (!fornitore) return res.status(400).json({ error: "Fornitore non valido" });
  try {
    const ids = db.prepare("SELECT id FROM articoli WHERE fornitore = ?").all(fornitore);
    const artIds = ids.map((r) => r.id);
    if (artIds.length === 0) return res.status(404).json({ error: "Nessun articolo per questo fornitore" });
    db.transaction(() => {
      for (const id of artIds) {
        db.prepare("DELETE FROM varianti WHERE articolo_id = ?").run(id);
        db.prepare("DELETE FROM articoli WHERE id = ?").run(id);
      }
    })();
    return res.json({ ok: true, eliminati: artIds.length });
  } catch (e) {
    return res.status(500).json({ error: "Errore interno", dettagli: String(e?.message ?? e) });
  }
});

app.patch("/api/varianti/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "ID variante non valido" });
  const { colore, taglia, quantita, box } = req.body || {};
  try {
    const row = db.prepare("SELECT id FROM varianti WHERE id = ?").get(id);
    if (!row) return res.status(404).json({ error: "Variante non trovata" });
    if (colore !== undefined) db.prepare("UPDATE varianti SET colore = ? WHERE id = ?").run(String(colore).trim(), id);
    if (taglia !== undefined) db.prepare("UPDATE varianti SET taglia = ? WHERE id = ?").run(String(taglia).trim(), id);
    if (typeof quantita === "number" && Number.isFinite(quantita) && quantita >= 0)
      db.prepare("UPDATE varianti SET quantita = ? WHERE id = ?").run(quantita, id);
    if (box !== undefined) db.prepare("UPDATE varianti SET box = ? WHERE id = ?").run(box === "" ? 0 : Number(box) || 0, id);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Errore interno", dettagli: String(e?.message ?? e) });
  }
});

app.delete("/api/varianti/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "ID variante non valido" });
  try {
    const info = db.prepare("DELETE FROM varianti WHERE id = ?").run(id);
    if (info.changes === 0) return res.status(404).json({ error: "Variante non trovata" });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Errore interno", dettagli: String(e?.message ?? e) });
  }
});

app.get("/api/fornitori", (_req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        a.fornitore,
        COUNT(DISTINCT a.id) AS articoli,
        IFNULL(SUM(v.quantita), 0) AS quantita,
        IFNULL(SUM(a.prezzo * v.quantita), 0) AS valore
      FROM articoli a
      LEFT JOIN varianti v ON v.articolo_id = a.id
      GROUP BY a.fornitore
      ORDER BY a.fornitore COLLATE NOCASE ASC
    `
    )
    .all();

  res.json({ fornitori: rows });
});

app.get("/api/lista-acquisti", (_req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        a.fornitore,
        a.codice_articolo,
        v.colore,
        v.taglia,
        v.quantita,
        a.prezzo
      FROM articoli a
      INNER JOIN varianti v ON v.articolo_id = a.id
      ORDER BY a.fornitore COLLATE NOCASE ASC, a.codice_articolo COLLATE NOCASE ASC, v.colore COLLATE NOCASE ASC, v.taglia COLLATE NOCASE ASC
    `
    )
    .all();

  const gruppi = new Map();
  for (const r of rows) {
    if (!gruppi.has(r.fornitore)) {
      gruppi.set(r.fornitore, { fornitore: r.fornitore, totale: 0, righe: [] });
    }
    const g = gruppi.get(r.fornitore);
    const prezzo = Number(r.prezzo) || 0;
    const qty = Number(r.quantita) || 0;
    g.totale += prezzo * qty;
    g.righe.push({
      codice_articolo: r.codice_articolo || "",
      colore: r.colore || "",
      taglia: r.taglia || "",
      quantita: qty,
      prezzo
    });
  }
  res.json({ gruppi: Array.from(gruppi.values()) });
});

app.get("/api/export/solo-valori.csv", (_req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        a.fornitore,
        a.cliente,
        a.codice_articolo,
        a.descrizione,
        a.composizione,
        a.prezzo,
        v.colore,
        v.taglia,
        v.quantita,
        v.box,
        (a.prezzo * v.quantita) AS valore_riga
      FROM articoli a
      LEFT JOIN varianti v ON v.articolo_id = a.id
      ORDER BY a.fornitore COLLATE NOCASE ASC, a.codice_articolo COLLATE NOCASE ASC, v.colore COLLATE NOCASE ASC, v.taglia COLLATE NOCASE ASC
    `
    )
    .all();

  const csv = toCsv(
    rows,
    [
      { header: "Fornitore", get: (r) => r.fornitore },
      { header: "Cliente", get: (r) => r.cliente },
      { header: "Codice Articolo", get: (r) => r.codice_articolo },
      { header: "Prodotto", get: (r) => r.descrizione },
      { header: "Composizione", get: (r) => r.composizione },
      { header: "Prezzo", get: (r) => r.prezzo },
      { header: "Colore", get: (r) => r.colore ?? "" },
      { header: "Taglia", get: (r) => r.taglia ?? "" },
      { header: "Quantità", get: (r) => r.quantita ?? "" },
      { header: "Box", get: (r) => r.box ?? "" },
      { header: "Valore Riga", get: (r) => r.valore_riga ?? "" }
    ],
    { delimiter: ";", includeHeader: true }
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="report_solo_valori.csv"');
  res.send("\uFEFF" + csv);
});

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(port, () => {
  console.log(`API avviata su http://localhost:${port}`);
});

