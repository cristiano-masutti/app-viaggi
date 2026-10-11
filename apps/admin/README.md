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
| **Persone**             | account, viaggi di ognuno, ultimo accesso all'app, creazione di un account con password provvisoria mostrata una sola volta                                                            |
| **Uso dell'app**        | attivi oggi, in 7 e in 30 giorni, andamento giorno per giorno, schermate più viste, dispositivi, chi è in viaggio (o parte presto) e non entra, quanto usa l'app ogni crew in viaggio  |
| **Prestazioni**         | p75 di avvio, schermate, chiamate, fotogrammi lenti e blocchi dell'app; LCP, INP, CLS e TTFB del pannello; andamento, dove si perde tempo, confronto fra dispositivi                   |

Lo staff organizza come un coordinatore, con le stesse API dell'app e quindi
con le stesse regole (capienza, un documento in un solo posto, tipo di file
controllato dal contenuto, almeno un coordinatore). Due cose restano fuori di
proposito: i contenuti dei ricordi (il pannello ne mostra solo il numero) e i
dati sensibili del profilo (note mediche, codice fiscale, numero di passaporto).

### Metriche

I grafici sono SVG e HTML fatti a mano (`components/charts/`), senza librerie:
una tinta sola per i dati (`--color-series`, validata sul fondo scuro), lontana
dal rosso dell'accento e dai colori di stato, che restano per "Buono / Da
migliorare / Scarso" sempre con icona e parola. Ogni grafico ha un tooltip
raggiungibile anche da tastiera (frecce, Home, Fine) e la vista tabella con gli
stessi numeri. Le soglie sono in `lib/metrics.ts`. Periodo (`?giorni=`) e
sorgente (`?fonte=pannello`) stanno nell'indirizzo.

Il pannello misura anche sé stesso: `src/telemetry/` manda LCP, INP, CLS, TTFB
(con `web-vitals`) e la durata di ogni chiamata, raggruppate per pagina e per
percorso della specifica (mai con gli id), ogni 30 secondi e quando la scheda
va in secondo piano. Solo misure anonime, nessun evento d'uso.

## Come è fatto

```
src/
├── main.tsx               provider: query, Supabase, API, toast
├── AdminGate.tsx          sessione? staff? poi il router
├── router.tsx             /, /viaggi(/:id), /persone(/:id), /uso, /prestazioni (pagine caricate al bisogno)
├── api/
│   ├── schema.d.ts        tipi generati dalla specifica del backend (non a mano)
│   ├── queries.ts         letture e azioni di /api/admin
│   ├── plan.ts            organizzare un viaggio: le API del coordinatore
│   └── documents.ts       upload multipart e "tieni / stacca / carica" per ogni slot
├── auth/                  login Supabase (email e password, come l'app)
├── components/ui/         il design system dell'app in versione web
├── components/charts/     andamento (linea + tooltip + tabella) e classifiche a barre
├── telemetry/             le misure del pannello stesso
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

Le pagine vere, nel browser e contro il backend, le provano gli smoke test in
[`e2e/`](../../e2e): flussi, budget di velocità, regole di layout e
accessibilità (WCAG 2.2 AA) e confronto con le immagini di riferimento, su
telefono e su desktop.
