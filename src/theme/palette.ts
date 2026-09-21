import type { ViewStyle } from 'react-native';

import tokens from './tokens';

/**
 * Stessi valori di `tailwind.config.js`, esposti tipizzati per le prop native che
 * non passano da NativeWind: colore delle icone lucide, `shadowColor`,
 * `StatusBar`, `tintColor` dei blur, `placeholderTextColor`.
 */
export const palette = {
  /** #0D0D11 — Pitch Black profondo, il fondo di ogni schermata. */
  background: tokens.ink[950],
  /** #16161D — Deep Slate, il colore di card e fogli. */
  surface: tokens.ink[900],
  /** #1B1B24 — superficie sollevata: input, chip spenti, bottoni secondari. */
  surfaceRaised: tokens.ink[850],
  /** #262633 — bordo di tutto e base dello skeleton shimmer. */
  border: tokens.ink[700],

  /** #FF5B22 — Electric Tangerine, un solo accento in tutta l'app. */
  accent: tokens.tangerine.DEFAULT,
  accentSoft: tokens.tangerine.soft,
  accentTint: tokens.tangerine.tint,

  /** Carta del diario: Vintage Cream Warm. */
  cream: tokens.cream.DEFAULT,
  creamLine: tokens.cream.line,
  creamInk: tokens.cream.ink,

  /** Testo su fondo scuro. */
  text: tokens.bone,
  textMuted: tokens.mist,

  live: tokens.live,
  success: tokens.success,
  danger: tokens.danger,
} as const;

/** Opacità ricorrenti del testo primario, pronte per `color={...}`. */
export const textAlpha = {
  /** Sottotitoli e metadati. */
  muted: 'rgba(244,242,237,0.62)',
  /** Etichette di sezione. */
  faint: 'rgba(244,242,237,0.42)',
  /** Icone spente nella tab bar. */
  off: 'rgba(244,242,237,0.44)',
} as const;

/**
 * Blurhash usati da `<SmartImage />` mentre la foto arriva.
 * Sono tinte coerenti con la palette, così il placeholder non "lampeggia"
 * bianco e non c'è layout shift: lo spazio è già occupato dal colore giusto.
 */
export const blurhash = {
  /** Grigio-inchiostro neutro: default di ogni immagine. */
  ink: 'L03[!t00xu00~qofRjay00ofofof',
  /** Paesaggio freddo (nord, ghiacciai, mare). */
  cold: 'LEHLk~WB2yk8pyo0adR*.7kCMdnj',
  /** Paesaggio caldo (deserto, tramonti, città). */
  warm: 'LHI=eTIU00xu0LWB%Mj[~qt7IUof',
  /** Ritratto / avatar. */
  portrait: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
} as const;

export type BlurhashKey = keyof typeof blurhash;

/**
 * Ombre. Su Android `elevation` è l'unico canale disponibile, su iOS si usano
 * le shadow*: entrambe sono incluse così il rilievo è identico sulle due
 * piattaforme senza `Platform.select` sparsi nei componenti.
 */
export const shadow = {
  /** Alone arancione sotto le azioni primarie. */
  accentGlow: {
    shadowColor: palette.accent,
    shadowOpacity: 0.34,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  } satisfies ViewStyle,
  /** Stacco morbido delle card sopra il fondo. */
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  } satisfies ViewStyle,
  /** Barre flottanti (tab bar, header sticky). */
  floating: {
    shadowColor: '#000000',
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  } satisfies ViewStyle,
} as const;
