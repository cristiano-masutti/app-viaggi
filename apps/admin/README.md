# Vibemakers — pannello di controllo

Il back-office dello staff: tutti i viaggi, le persone, le crew e i documenti,
con lo stesso aspetto dell'app (palette, card, badge, segmenti, scheletri).
React 19 + Vite + Tailwind 4 + TanStack Query, dati dal backend vero.

```bash
cp .env.example .env.local   # URL del backend e del progetto Supabase
npm install
npm run dev                  # http://localhost:5173
npm run verify               # lint, formato, tipi, test e build
npm run api:types            # rigenera src/api/schema.d.ts da ../backend/openapi.json
```

Per entrare serve un account Supabase con il ruolo di staff, che si concede
solo da riga di comando (nel backend: `npm run staff -- grant <email>`). Chi ha
un account ma non è staff vede una pagina che gli dice esattamente cosa
chiedere. Il backend deve ammettere l'origine del pannello in `CORS_ORIGIN`.

## Cosa si fa

| Sezione                 | Cosa c'è                                                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Panoramica**          | viaggi in corso con il badge LIVE dell'app, prossime partenze, posti occupati, persone in viaggio, viaggi con qualcosa da sistemare                                                    |
| **Viaggi**              | segmenti In corso / Futuri / Passati / Tutti, ricerca, nuovo viaggio con un coordinatore scelto                                                                                        |
| **Viaggio → Organizza** | programma giorno per giorno (alloggio e attività con voucher e biglietti), assicurazione, dogana / QR, mezzi con i loro documenti, contatti SOS; i file si caricano e si aprono da qui |
| **Viaggio → Crew**      | membri con contatti e stato del passaporto, ruoli, aggiunta e rimozione, posti riservati, link di invito                                                                               |
| **Pronto a partire?**   | la checklist di ogni viaggio: notti senza alloggio, assicurazione, mezzi, SOS, passaporti mancanti o in scadenza (6 mesi dopo il rientro)                                              |
| **Persone**             | account, viaggi di ognuno, creazione di un account con password provvisoria mostrata una sola volta                                                                                    |

Lo staff organizza come un coordinatore, con le stesse API dell'app e quindi
con le stesse regole (capienza, un documento in un solo posto, tipo di file
controllato dal contenuto, almeno un coordinatore). Due cose restano fuori di
proposito: i contenuti dei ricordi (il pannello ne mostra solo il numero) e i
dati sensibili del profilo (note mediche, codice fiscale, numero di passaporto).

## Come è fatto

```
src/
├── main.tsx               provider: query, Supabase, API, toast
├── AdminGate.tsx          sessione? staff? poi il router
├── router.tsx             /, /viaggi, /viaggi/:id, /persone, /persone/:id (pagine caricate al bisogno)
├── api/
│   ├── schema.d.ts        tipi generati dalla specifica del backend (non a mano)
│   ├── queries.ts         letture e azioni di /api/admin
│   ├── plan.ts            organizzare un viaggio: le API del coordinatore
│   └── documents.ts       upload multipart e "tieni / stacca / carica" per ogni slot
├── auth/                  login Supabase (email e password, come l'app)
├── components/ui/         il design system dell'app in versione web
└── pages/                 le schermate
```

- **La palette è una sola.** `tailwind.config.js` legge
  `apps/mobile/src/theme/tokens.js`: un colore cambiato lì cambia app e
  pannello insieme.
- **I file si caricano al salvataggio.** Scegliere un file non carica niente:
  `DocumentField` dice cosa fare (`keep`, `remove`, `upload`) e il caricamento
  parte solo con "Salva", subito prima dello slot che lo usa. Annullare non
  lascia file orfani.
- **Dopo ogni azione si rilegge il server.** Le azioni invalidano la chiave
  `admin` di TanStack Query: liste, dettagli e numeri della panoramica si
  riallineano da soli.
- **Filtri nell'indirizzo.** Stato, ricerca e pagina stanno nella query string:
  un link porta esattamente alla stessa lista.

## Test

`npm test` usa Vitest con jsdom e Testing Library, nel fuso `Europe/Rome`:
formattazione delle date e delle etichette, gestione degli errori dell'API,
upload multipart, il campo documento e il cancello "solo staff" con Supabase e
`fetch` finti (`src/test/fakes.ts`).
