# Kanouse SRL — Gestione contabile

App di controllo di gestione in partita doppia per Kanouse SRL.

---

## Setup in 4 passi

### Passo 1 — Crea il database su Supabase

1. Vai su [supabase.com](https://supabase.com) → apri il tuo progetto
2. Clicca **SQL Editor** nel menu a sinistra
3. Clicca **New query**
4. Copia e incolla tutto il contenuto del file `supabase-schema.sql`
5. Clicca **Run** (o Ctrl+Enter)

Dovresti vedere "Success. No rows returned."

---

### Passo 2 — Installa le dipendenze

Apri il terminale nella cartella del progetto:

```bash
npm install
```

---

### Passo 3 — Avvia in locale (per testare)

```bash
npm run dev
```

Apri il browser su `http://localhost:5173`

---

### Passo 4 — Deploy su Vercel

1. Crea un repository su [github.com](https://github.com):
   - Clicca **+** → **New repository**
   - Nome: `kanouse-srl`
   - Clicca **Create repository**

2. Nella cartella del progetto, esegui:
```bash
git init
git add .
git commit -m "primo commit"
git remote add origin https://github.com/TUO-USERNAME/kanouse-srl.git
git push -u origin main
```

3. Vai su [vercel.com](https://vercel.com):
   - Clicca **Add New Project**
   - Importa il repository `kanouse-srl`
   - Nella sezione **Environment Variables** aggiungi:
     - `VITE_SUPABASE_URL` = `https://pkdsrhtyrrtxzzxgqosx.supabase.co`
     - `VITE_SUPABASE_ANON_KEY` = la tua chiave anon
   - Clicca **Deploy**

In 2 minuti hai l'URL pubblico dell'app.

---

## Struttura app

| Sezione | Funzione |
|---|---|
| Dashboard | Cassetti, metriche, ultimi movimenti |
| Nuova scrittura | Registra eventi con calcoli automatici |
| Modelli | Scritture predefinite riutilizzabili |
| Partitario | Tutti i movimenti con filtri |
| Stato patrimoniale | Fotografia patrimoniale |
| Conto economico | Ricavi vs costi, margine |
| Mastrini | Piano dei conti personalizzabile |
| Regimi contrattuali | Aliquote per tipo di contratto |

---

## Note importanti

- Il file `.env` contiene le credenziali Supabase ed è escluso da Git (`.gitignore`)
- Su Vercel le credenziali vanno inserite come **Environment Variables**
- La `anon key` è sicura nel frontend — non è la `service_role`
- Per aggiungere autenticazione in futuro, abilita Supabase Auth e aggiorna le RLS policy
