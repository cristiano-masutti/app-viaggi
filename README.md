# Vibemakers Travel — prototipo mobile

Prototipo frontend completo dell'app di viaggi di gruppo, per **iOS e Android**.
React Native + Expo + TypeScript + NativeWind, stato mock completo e navigabile:
si accede, si entra in un viaggio, si filtrano i ricordi, si modificano i
documenti e si crea un viaggio nuovo senza toccare una riga di codice.

```bash
npm install
npm run ios        # oppure: npm run android
npm run typecheck  # tsc --noEmit
```

> Le dipendenze native sono già allineate a Expo SDK 57: `npx expo start` basta
> per Expo Go o per una dev build.

---

## Le regole che tengono insieme il progetto

### 1 · Rendering e liste

| Regola | Come è applicata |
| --- | --- |
| Mai `FlatList` | Le liste lunghe passano da `@shopify/flash-list`: griglia masonry dei ricordi e timeline del diario (`MemoriesTab`), feed dei viaggi (`MyTripsScreen`). |
| Mai `<Image>` di React Native | Esiste un solo modo di mostrare un'immagine: `<SmartImage />` (`expo-image` con cache `memory-disk`, blurhash come placeholder, crossfade e `recyclingKey`). |
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

**Nota sugli scroll handler** — FlashList invoca `onScroll` direttamente dal JS
e non accetta un worklet: `useHeaderScroll()` espone per questo due gestori,
`onScroll` (worklet, per `Animated.ScrollView`) e `onScrollJS` (per FlashList).
In entrambi i casi l'interpolazione della sfocatura resta un worklet.

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

### 4 · Regola aurea di UX

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
App.tsx                      providers (gesture → safe area → sheets → store → toast)
src/
├── theme/
│   ├── tokens.js            palette, unica fonte di verità (letta da Tailwind)
│   ├── palette.ts           versione tipizzata + blurhash + ombre
│   ├── motion.ts            molle e curve condivise
│   └── interop.ts           registra className sui componenti di terze parti
├── types/index.ts           modello dati (il contratto mock ↔ UI)
├── mock/                    stato iniziale: 5 viaggi, crew, ricordi, documenti
├── store/AppStore.tsx       reducer unico + hook di lettura
├── lib/                     date, haptics, id, helper viaggio, scroll header
├── navigation/
│   ├── RootNavigator.tsx    Login ⇢ Main ⇢ TripDetail / CreateTrip / Success
│   ├── MainTabs.tsx         due tab (+ TODO per il futuro "Esplora")
│   └── FloatingTabBar.tsx   barra flottante sfocata
├── components/
│   ├── ui/                  design system (PressableScale, SmartImage, …)
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
- **Renderer PDF**: `DocumentViewerModal` disegna un foglio mock; la struttura
  del viewer è definitiva, va sostituito solo il blocco centrale. Il QR è
  generato con `react-native-svg` a partire dal codice pratica: stabile e
  realistico, ma non scansionabile.
- **Tab "Esplora"**: predisposto con un TODO in `MainTabs.tsx` e
  `navigation/types.ts`.
- **Font**: si usa il font di sistema. Il punto di estensione è `theme/`.
