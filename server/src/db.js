import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "app.sqlite");
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL DEFAULT 1);
    INSERT OR IGNORE INTO schema_version (version) VALUES (1);
  `);

  const versionRow = db.prepare("SELECT version FROM schema_version LIMIT 1").get();
  const schemaVersion = versionRow ? versionRow.version : 1;

  const articoliExists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='articoli'").get();

  if (!articoliExists) {
    db.exec(`
      CREATE TABLE articoli (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codice_articolo TEXT NOT NULL,
        descrizione TEXT NOT NULL,
        composizione TEXT NOT NULL,
        prezzo REAL NOT NULL DEFAULT 0,
        foto_data_url TEXT,
        fornitore TEXT NOT NULL,
        cliente TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(fornitore, codice_articolo)
      );
      CREATE INDEX IF NOT EXISTS idx_articoli_fornitore ON articoli(fornitore);
    `);
    db.prepare("UPDATE schema_version SET version = 2").run();
  } else if (schemaVersion < 2) {
    db.pragma("foreign_keys = OFF");
    db.exec(`
      CREATE TABLE articoli_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codice_articolo TEXT NOT NULL,
        descrizione TEXT NOT NULL,
        composizione TEXT NOT NULL,
        prezzo REAL NOT NULL DEFAULT 0,
        foto_data_url TEXT,
        fornitore TEXT NOT NULL,
        cliente TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(fornitore, codice_articolo)
      );
      INSERT INTO articoli_new (id, codice_articolo, descrizione, composizione, prezzo, foto_data_url, fornitore, cliente, created_at)
      SELECT id, codice_articolo, descrizione, composizione, prezzo, foto_data_url, fornitore, cliente, created_at FROM articoli;
      DROP TABLE articoli;
      ALTER TABLE articoli_new RENAME TO articoli;
      CREATE INDEX IF NOT EXISTS idx_articoli_fornitore ON articoli(fornitore);
    `);
    db.prepare("UPDATE schema_version SET version = 2").run();
    db.pragma("foreign_keys = ON");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS varianti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      articolo_id INTEGER NOT NULL,
      colore TEXT NOT NULL,
      taglia TEXT NOT NULL,
      quantita INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (articolo_id) REFERENCES articoli(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_varianti_articolo_id ON varianti(articolo_id);
  `);

  const cols = db.prepare("PRAGMA table_info(varianti)").all();
  if (!cols.some((c) => c.name === "box")) {
    db.exec("ALTER TABLE varianti ADD COLUMN box INTEGER DEFAULT 0");
  }
}

