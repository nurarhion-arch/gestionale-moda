-- Esegui questo script nel SQL Editor di Supabase (Dashboard → SQL Editor)
-- per creare le tabelle se non esistono.

-- Tabella articoli
CREATE TABLE IF NOT EXISTS articoli (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  art TEXT NOT NULL,
  descrizione TEXT NOT NULL DEFAULT '',
  composizione TEXT NOT NULL DEFAULT '',
  prezzo NUMERIC NOT NULL DEFAULT 0,
  foto_url TEXT,
  fornitore TEXT NOT NULL DEFAULT '',
  cliente TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(fornitore, art)
);

CREATE INDEX IF NOT EXISTS idx_articoli_fornitore ON articoli(fornitore);

-- Tabella varianti
CREATE TABLE IF NOT EXISTS varianti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_articolo UUID NOT NULL REFERENCES articoli(id) ON DELETE CASCADE,
  colore TEXT NOT NULL DEFAULT '',
  taglia TEXT NOT NULL DEFAULT '',
  quantita INTEGER NOT NULL DEFAULT 0,
  totale NUMERIC NOT NULL DEFAULT 0,
  box TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_varianti_ref_articolo ON varianti(ref_articolo);

-- Tabella preferenze (sostituisce localStorage per fornitore/cliente)
CREATE TABLE IF NOT EXISTS preferenze (
  chiave TEXT PRIMARY KEY,
  valore TEXT NOT NULL DEFAULT ''
);

-- Policy RLS: consentire tutte le operazioni per anon (usa la tua anon key).
-- Per produzione restringi con auth.uid().
ALTER TABLE articoli ENABLE ROW LEVEL SECURITY;
ALTER TABLE varianti ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferenze ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all articoli" ON articoli;
CREATE POLICY "Allow all articoli" ON articoli FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all varianti" ON varianti;
CREATE POLICY "Allow all varianti" ON varianti FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all preferenze" ON preferenze;
CREATE POLICY "Allow all preferenze" ON preferenze FOR ALL USING (true) WITH CHECK (true);
