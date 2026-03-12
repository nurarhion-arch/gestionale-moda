# Gestionale Logistica Moda (React + SQLite)

App web gestionale per logistica moda, in italiano.

## Requisiti

- Node.js 18+ (consigliato 20+)

## Avvio (sviluppo)

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend/API: `http://localhost:3001`

## Database

Il database SQLite viene creato automaticamente in `server/data/app.sqlite`.

## Funzionalità

- Database **articoli**: codice articolo, descrizione, composizione, prezzo, foto, fornitore, cliente
- Database **varianti** (collegato agli articoli): colore, taglia, quantità
- Schermata inserimento articoli + varianti
- Schermata elenco articoli raggruppati per fornitore + totali
- Export CSV “solo valori”

