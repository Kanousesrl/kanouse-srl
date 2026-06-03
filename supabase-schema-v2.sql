-- Kanouse SRL — Schema v2 (aggiornamento)
-- Se hai già eseguito la v1, esegui SOLO questo file per aggiornare

-- Aggiungi colonne mancanti alla tabella movimenti
ALTER TABLE movimenti 
  ADD COLUMN IF NOT EXISTS conto_liquidita text,
  ADD COLUMN IF NOT EXISTS costi jsonb,
  ADD COLUMN IF NOT EXISTS righe_libere jsonb,
  ADD COLUMN IF NOT EXISTS cap_totale numeric(12,2),
  ADD COLUMN IF NOT EXISTS cap_versato numeric(12,2);

-- Aggiorna tipo mastrini con nuove categorie
-- (la colonna tipo esiste già, non serve ALTER)

-- Inserisci mastrini di sistema aggiuntivi se mancano
INSERT INTO mastrini (nome, tipo, sistema) VALUES
  ('Cassa contanti', 'disponibilita', true),
  ('Banca c/c principale', 'disponibilita', true),
  ('Soci c/sottoscrizione', 'attivo', true),
  ('Soci c/versamenti ancora dovuti', 'attivo', true)
ON CONFLICT DO NOTHING;

-- Regime di esempio aggiornato (se non esiste già)
INSERT INTO regimi (nome, note, voci, percentuale_totale)
SELECT 
  'Contratto a chiamata',
  'Collaboratori occasionali',
  '[{"nome":"INPS gestione separata (datore)","base":"netto","percentuale":13.23},{"nome":"IRAP","base":"netto","percentuale":3.9},{"nome":"Ritenuta acconto IRPEF","base":"netto","percentuale":20}]',
  37.13
WHERE NOT EXISTS (SELECT 1 FROM regimi WHERE nome = 'Contratto a chiamata');
