-- Kanouse SRL — Schema Supabase
-- Esegui questo SQL nell'editor di Supabase (SQL Editor → New query)

-- Movimenti contabili (partita doppia)
create table if not exists movimenti (
  id bigserial primary key,
  created_at timestamptz default now(),
  data date not null,
  tipo text not null,
  attivita text not null default 'comune',
  descrizione text,
  importo numeric(12,2) not null default 0,
  iva numeric(12,2) not null default 0,
  aliquota integer default 0,
  compensi jsonb,
  accantonamenti jsonb,
  righe jsonb not null default '[]'
);

-- Modelli di scrittura predefiniti
create table if not exists modelli (
  id bigserial primary key,
  created_at timestamptz default now(),
  nome text not null,
  tipo text not null,
  attivita text not null default 'comune',
  descrizione text,
  aliquota integer default 10,
  compensi jsonb,
  accantonamenti jsonb
);

-- Mastrini (piano dei conti personalizzabile)
create table if not exists mastrini (
  id bigserial primary key,
  created_at timestamptz default now(),
  nome text not null,
  tipo text not null,
  note text,
  sistema boolean default false
);

-- Regimi contrattuali
create table if not exists regimi (
  id bigserial primary key,
  created_at timestamptz default now(),
  nome text not null,
  note text,
  voci jsonb default '[]',
  percentuale_totale numeric(6,2) default 0
);

-- Mastrini di sistema (inseriti una volta sola)
insert into mastrini (nome, tipo, sistema) values
  ('Conto corrente', 'attivo', true),
  ('Crediti verso clienti', 'attivo', true),
  ('Crediti verso soci', 'attivo', true),
  ('Attrezzature', 'attivo', true),
  ('IVA a credito', 'attivo', true),
  ('Debiti verso fornitori', 'passivo', true),
  ('Debiti verso dipendenti', 'passivo', true),
  ('IVA a debito', 'passivo', true),
  ('Fondo imposte', 'fondo_accantonamento', true),
  ('Fondo contributi', 'fondo_accantonamento', true),
  ('Capitale sociale', 'netto', true),
  ('Ricavi Wedding', 'ricavo', true),
  ('Ricavi La Serra', 'ricavo', true),
  ('Costi del personale', 'costo', true),
  ('Acquisti e forniture', 'costo', true),
  ('Accantonamenti', 'costo', true)
on conflict do nothing;

-- Regime di esempio (contratto a chiamata)
insert into regimi (nome, note, voci, percentuale_totale) values (
  'Contratto a chiamata',
  'Collaboratori occasionali con ritenuta d''acconto',
  '[
    {"nome": "INPS gestione separata (datore)", "base": "netto", "percentuale": 13.23},
    {"nome": "IRAP", "base": "netto", "percentuale": 3.9},
    {"nome": "Ritenuta d''acconto (anticipo IRPEF)", "base": "netto", "percentuale": 20}
  ]',
  37.13
);

-- RLS: disabilitato per ora (app privata, un solo utente)
-- Se vuoi aggiungere autenticazione in futuro, abilita RLS e crea le policy

alter table movimenti enable row level security;
alter table modelli enable row level security;
alter table mastrini enable row level security;
alter table regimi enable row level security;

-- Policy permissiva (accesso completo senza auth — per uso privato)
create policy "public access" on movimenti for all using (true) with check (true);
create policy "public access" on modelli for all using (true) with check (true);
create policy "public access" on mastrini for all using (true) with check (true);
create policy "public access" on regimi for all using (true) with check (true);
