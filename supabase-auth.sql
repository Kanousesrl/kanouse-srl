-- Kanouse SRL — Attiva autenticazione sulle tabelle
-- Esegui questo nel SQL Editor di Supabase

-- Rimuovi le policy permissive precedenti
DROP POLICY IF EXISTS "public access" ON movimenti;
DROP POLICY IF EXISTS "public access" ON modelli;
DROP POLICY IF EXISTS "public access" ON mastrini;
DROP POLICY IF EXISTS "public access" ON regimi;

-- Nuove policy: accesso solo agli utenti autenticati
CREATE POLICY "auth access" ON movimenti FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth access" ON modelli FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth access" ON mastrini FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth access" ON regimi FOR ALL TO authenticated USING (true) WITH CHECK (true);
