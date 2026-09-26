# Vibemakers Travel — prototipo mobile

Prototipo frontend completo dell'app di viaggi di gruppo, per **iOS e Android**.
React Native + Expo + TypeScript + NativeWind, stato mock completo e navigabile:
si accede, si entra in un viaggio, si filtrano i ricordi, si modificano i
documenti e si crea un viaggio nuovo senza toccare una riga di codice.

```bash
fnm use            # oppure: nvm use — legge .nvmrc (Node 24 LTS)
npm install
npm run ios        # oppure: npm run android
npm run typecheck  # tsc --noEmit
```

> Le dipendenze native sono già allineate a Expo SDK 57: `npx expo start` basta
> per Expo Go o per una dev build.
>
> Nota: in monorepo il backend è in [apps/backend/](../backend); la panoramica
> generale è nella README root [../../README.md](../../README.md).

### Versione di Node

| File | Ruolo |
| --- | --- |
| `.nvmrc` | La versione di riferimento: **Node 24 LTS**. La leggono fnm, nvm, GitHub Actions (`node-version-file`) e Renovate. |
| `package.json` → `engines` / `devEngines` | Il range accettato, `^22.13.0 \|\| >=24.3.0`, cioè quello di React Native 0.86 senza Node 20 (fuori supporto da aprile 2026). |
| `.npmrc` → `engine-strict=true` | Con un Node fuori range `npm install` e `npm run …` si fermano con `EBADDEVENGINES` invece di installare lo stesso; anche gli `EBADENGINE` delle dipendenze diventano errori. |

Il modo più comodo è [fnm](https://github.com/Schniz/fnm), che cambia versione
da solo entrando nella cartella:

```bash
brew install fnm                                   # macOS; su Windows: winget install Schniz.fnm
echo 'eval "$(fnm env --use-on-cd)"' >> ~/.zshrc   # poi riapri il terminale
cd app-viaggi && fnm install                       # installa la versione di .nvmrc
```

Ogni versione di Node porta il suo npm (Node 24 → npm 11): non serve
`npm i -g npm`. Dopo un cambio di versione maggiore conviene ripartire puliti
con `npm ci`.

### `overrides` in package.json

`xcode` (usato da `@expo/config-plugins` per il prebuild iOS) dipende ancora da
`uuid@7`, deprecato e colpito da
[GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq): da solo
generava tutti i 10 avvisi di `npm audit`. L'override forza `uuid@^11.1.1` solo
sotto `xcode`, che ne usa unicamente `v4()`, ancora esportato in CommonJS.
Verificato con `npx expo prebuild --platform ios`. Quando Expo aggiornerà
`xcode` l'override si può togliere. **Mai `npm audit fix --force`**: per
"risolvere" riporterebbe Expo alla 46.

---

## Le regole che tengono insieme il progetto

### 1 · Rendering e liste

| Regola | Come è applicata |
| --- | --- |
| Mai `FlatList` | Le liste lunghe passano da `@shopify/flash-list`: griglia masonry dei ricordi e timeline del diario (`MemoriesTab`), feed dei viaggi (`MyTripsScreen`). |
| Mai `<Image>` di React Native | Esiste un solo modo di mostrare un'immagine: `<SmartImage />` (`expo-image` con cache `memory-disk`, blurhash come placeholder, crossfade e `recyclingKey`). |
| Documenti sempre offline | Nessun tasto "Salva offline": ogni documento finisce sul disco da solo appena entra nel viaggio (vedi §4). |
| Zero layout shift | Ogni contenitore ha dimensioni note prima dei dati: cover 236/132 px, celle della griglia dimensionate da `aspectRatio` (un campo del dato), skeleton della stessa forma della card vera. |
| Skeleton, non spinner | `<Skeleton />` è un blocco `#262633` attraversato da un'onda di luce. Nessuno spinner rotante in tutta l'app. |

### 2 · Gesti e animazioni

Tutto quello che si muove gira su **UI thread**.

- `PressableScale` è il mattone di ogni elemento toccabile: il gesto è nativo
  (`react-native-gesture-handler`), la molla è Reanimated. Al JS thread arriva
  solo `onPress`.
- `SegmentedSwitcher` e `FloatingTabBar` muovono **un solo** indicatore che
  scivola; anche il colore delle etichette segue la stessa molla, così testo e
  sfondo non si separano a metà transizione.
- `ZoomableImage` compone pinch + pan + doppio tap in gesti nativi: è il cuore
  sia del visore dei ricordi sia di quello del passaporto.
- L'editing contestuale è un foglio magnetico nativo (`@gorhom/bottom-sheet`).
- Header e tab bar sono sfocati con `expo-blur`; l'opacità del velo è guidata
  dallo scroll.
- `expo-haptics` solo dove serve: bottoni primari, selezione dei filtri,
  conferme (`src/lib/haptics.ts`).

**Nota sugli scroll handler** — FlashList invoca `onScroll` come una normale
funzione JS e va in crash se gli si passa un worklet Reanimated. Per questo
`useHeaderScroll()` non usa `onScroll` affatto: si aggancia al componente
scrollabile con un *animated ref* e legge l'offset via `useScrollOffset`, cioè
direttamente sull'UI thread. FlashList continua a usare il proprio `onScroll`
per la virtualizzazione, noi leggiamo da un'altra strada e i due non si toccano.
Alle liste si passa `renderScrollComponent`, alle pagine semplici `ref`.

### 3 · Palette

Un'unica fonte di verità in `src/theme/tokens.js`, letta sia da
`tailwind.config.js` sia — tipizzata — da `src/theme/palette.ts`, così un colore
non può divergere tra classi NativeWind e prop native.

| Token | Valore | Uso |
| --- | --- | --- |
| `ink-950` | `#0D0D11` | Fondo di ogni schermata |
| `ink-900` | `#16161D` | Card e superfici |
| `ink-850` | `#1B1B24` | Input, bottoni secondari |
| `ink-700` | `#262633` | Bordi, divider, base dello skeleton |
| `tangerine` | `#FF5B22` | Accento primario, uno solo |
| `cream` | `#F7F4EA` / testo `#1C1917` | Note del diario |

### 4 · I documenti stanno sul telefono

Un voucher serve al gate d'imbarco, in un ostello islandese, in un taxi
marocchino: esattamente dove la rete non c'è. Per questo **non esiste un tasto
"Salva offline"**. Appena un documento entra in un viaggio, `OfflineLibrary` lo
mette in coda e lo scrive su disco da solo; il viewer legge sempre dalla copia
locale.

- I file vivono in `documentDirectory/documenti/<id>.<ext>`, che il sistema non
  ripulisce da solo. Il percorso è deterministico, quindi **l'indice è il disco
  stesso**: niente registro parallelo da tenere sincronizzato e lo stato
  sopravvive ai riavvii per costruzione.
- Coda a concorrenza 3, con ritenta esplicita sui falliti.
- Un file scelto dal rullino o dal file picker è già sul dispositivo: non viene
  ricopiato.
- I documenti sostituiti o rimossi lasciano il disco (`pruneOrphans`), altrimenti
  dopo qualche viaggio resterebbero centinaia di megabyte invisibili all'utente.
- La UI dichiara un **fatto**, non offre un'azione: una riga di stato in cima
  alla tab Organizza, e un indicatore per documento che compare solo quando c'è
  qualcosa di anomalo — dodici spunte verdi identiche sarebbero solo rumore.

Il Passaporto Master del profilo entra nella stessa biblioteca: viaggia con
l'utente, non con il viaggio, ma serve agli stessi controlli.

### 5 · Regola aurea di UX

- **Un solo punto d'ingresso per funzione.** Il Profilo si raggiunge solo dal
  tab "Profilo": negli header non esiste nessun avatar cliccabile.
- **La card del viaggio è un solo bersaglio.** Il blocco `Entra nel Viaggio ➔`
  è l'affordance visiva di quel tocco, non un secondo bottone dentro la card.
- **Tap per Visualizzare.** Nessun QR e nessun documento resta aperto a display:
  nelle liste c'è solo il tasto, il contenuto vive nel viewer a schermo intero.
- **Aggiungere e modificare portano allo stesso posto.** Il placeholder
  tratteggiato e la matita aprono la stessa identica modale.
- **Un glifo per elemento.** Dove l'etichetta porta già la sua emoji
  (`📄 Prenotazione`) non c'è anche l'icona: mai due segni per la stessa cosa.

---

## Struttura

```
App.tsx                      providers (gesture → safe area → sheets → store → offline → toast)
src/
├── theme/
│   ├── tokens.js            palette, unica fonte di verità (letta da Tailwind)
│   ├── palette.ts           versione tipizzata + blurhash + ombre
│   ├── motion.ts            molle e curve condivise
│   └── interop.ts           registra className sui componenti di terze parti
├── types/index.ts           modello dati (il contratto mock ↔ UI)
├── mock/                    stato iniziale: 5 viaggi, crew, ricordi, documenti
├── store/
│   ├── AppStore.tsx         reducer unico + hook di lettura
│   └── OfflineLibrary.tsx   coda che porta ogni documento sul disco
├── lib/                     date, haptics, id, helper viaggio, scroll header,
│                            archiviazione offline dei documenti
├── navigation/
│   ├── RootNavigator.tsx    Login ⇢ Main ⇢ TripDetail / CreateTrip / Success
│   ├── MainTabs.tsx         due tab (+ TODO per il futuro "Esplora")
│   └── FloatingTabBar.tsx   barra flottante sfocata
├── components/
│   ├── ui/                  design system (PressableScale, SmartImage, …)
│   ├── offline/             riga di stato e indicatori della copia locale
│   ├── trips/TripCards.tsx  Hero (in corso) e Standard (futuri = passati)
│   ├── memories/            griglia, diario, tile, reazioni, modale ricordo
│   ├── organize/            tab Organizza + configurazione delle modali
│   ├── sheets/EditSheet.tsx unica modale di editing rapido dell'app
│   └── viewers/             documenti, QR, foto zoomabili
└── screens/                 le sei schermate
```

### Perché una sola `EditSheet`

Alloggio, attività, passaporto, dogana, trasporti e assicurazione usano tutti lo
stesso foglio: cambia solo l'elenco dei campi, descritto in
`src/components/organize/editConfig.ts`. Sei modali quasi identiche sarebbero
sei posti da tenere allineati a ogni cambio di design — e sei comportamenti
leggermente diversi da imparare per l'utente.

---

## Lo stato mock

`src/mock/trips.ts` costruisce cinque viaggi con date **relative a oggi**, così
il prototipo è sempre vivo, e volutamente diversi tra loro per coprire ogni
stato della UI:

| Viaggio | Stato | A cosa serve |
| --- | --- | --- |
| Islanda On The Road 🇮🇸 | in corso, Giorno 3 di 10 | Hero card, ricordi, documenti pieni — e G6…G10 vuoti, per vedere i placeholder dentro un viaggio già partito |
| Giappone Discovery 🇯🇵 | futuro, −18 giorni | Documenti parziali: volo sì, assicurazione no |
| Perù & Machu Picchu 🇵🇪 | futuro, −64 giorni | Viaggio appena pianificato: tab Organizza tutta tratteggiata |
| Marocco Express 🇲🇦 | concluso | Archivio con ricordi e note |
| Portogallo Surf 🇵🇹 | concluso | Archivio leggero |

Il login accetta qualunque credenziale. Lo "Sblocco Rapido" compare solo quando
il device ha hardware biometrico, un'impronta registrata e una sessione salvata:
è volutamente agnostico — icona neutra e dicitura identica su iOS e Android.

---

## Verifica fatta

- `npx tsc --noEmit` pulito (strict).
- Bundle Metro completo per **iOS** e **Android** (`npx expo export`), 3.529 moduli, nessun errore.
- Giro completo dei flussi nel browser (build web + Chromium headless): login,
  i tre segmenti dell'hub, dettaglio viaggio, filtri combinati, viewer del QR,
  foglio di editing, modale "Nuovo Ricordo", profilo e creazione viaggio fino
  alla schermata di successo — **zero errori a runtime**.

Il target resta iOS/Android: `react-native-web` è incluso perché rende `npm run
web` una via di verifica rapida, non perché il web sia una piattaforma di
destinazione.

---

## Cosa manca (di proposito)

- **Backend**: l'autenticazione è un `setTimeout` e i dati vivono in memoria. I
  punti di innesto sono marcati `TODO — AUTH` in `LoginScreen`.
- **Endpoint dei documenti**: gli URI mock puntano a `files.vibemakers.travel`,
  che non esiste. Finché è così, `saveForOffline` scrive per quei soli URI un
  segnaposto vero sul disco, così percorsi, stati e UI girano per davvero: una
  costante e un ramo, marcati `SHIM DI PROTOTIPO`, da cancellare quando il
  backend risponde. Il resto del modulo è già il codice definitivo. Su web
  `expo-file-system` è uno stub, quindi lì lo stato è dichiarato come anteprima.
- **Renderer PDF**: `DocumentViewerModal` disegna un foglio mock; la struttura
  del viewer è definitiva, va sostituito solo il blocco centrale. Il QR è
  generato con `react-native-svg` a partire dal codice pratica: stabile e
  realistico, ma non scansionabile.
- **Tab "Esplora"**: predisposto con un TODO in `MainTabs.tsx` e
  `navigation/types.ts`.
- **Font**: si usa il font di sistema. Il punto di estensione è `theme/`.
