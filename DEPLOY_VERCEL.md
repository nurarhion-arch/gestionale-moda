# Deploy su Vercel (punto 2)

Segui questi passi per mettere l'app online con un link.

## 1. Account e progetto

1. Vai su [vercel.com](https://vercel.com) e accedi (o crea un account con GitHub/GitLab/Email).
2. Clicca **"Add New…"** → **"Project"**.
3. **Importa il progetto:**
   - Se il codice è su **GitHub/GitLab/Bitbucket**: connetti il repository e seleziona `GESTIONALE_LOGISTICA`.
   - Se **non** usi Git: in Cursor apri il terminale nella cartella del progetto, esegui `npx vercel` e segui le istruzioni (serve aver installato Vercel CLI: `npm i -g vercel`).

## 2. Impostazioni del progetto (importante)

Nella schermata di configurazione del progetto:

| Campo | Valore |
|-------|--------|
| **Root Directory** | `client` (clicca "Edit", inserisci `client`, conferma) |
| **Framework Preset** | Vite (dovrebbe essere rilevato) |
| **Build Command** | `npm run build` (default) |
| **Output Directory** | `dist` (default) |
| **Install Command** | `npm install` (default) |

Non cambiare altro.

## 3. Variabili d'ambiente

Nella stessa schermata (o dopo: **Project → Settings → Environment Variables**), aggiungi:

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | `https://giwufxumvyvitqmysrup.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | la tua chiave (es. `sb_publishable_mTa0DUTQBaGR2c8ISLuG_A_uzXtNpYo`) |

Inseriscile per **Production** (e se vuoi anche Preview). Poi clicca **Deploy**.

## 4. Deploy

- Vercel eseguirà `npm install` e `npm run build` nella cartella `client`.
- Al termine avrai un link tipo: `https://gestionale-logistica-xxx.vercel.app`.
- Apri il link: l'app userà Supabase con le variabili che hai impostato.

## 5. Aggiornamenti futuri

- Se hai collegato un repo Git: ogni push sul branch principale (es. `main`) farà un nuovo deploy automatico.
- Se hai usato `npx vercel` senza Git: per aggiornare l'app esegui di nuovo `npx vercel --prod` dalla cartella del progetto.

---

**Nota:** Il server Express (cartella `server`) non viene deployato: in produzione l'app usa solo Supabase dal browser.
