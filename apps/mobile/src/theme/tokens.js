/**
 * tokens.js — unica fonte di verità della palette.
 *
 * È volutamente CommonJS: viene letto sia da `tailwind.config.js` (Node, a build
 * time) sia dal codice applicativo tramite `src/theme/palette.ts` (tipizzato).
 * Così un colore esiste in un solo punto e non può divergere tra classi
 * NativeWind e prop native (icone, shadow, StatusBar, blurhash).
 */
module.exports = {
  /** Fondo profondo dell'app: Pitch Black / Dark Obsidian. */
  ink: {
    950: '#0D0D11', // background principale
    900: '#16161D', // card e superfici (Deep Slate / Inchiostro)
    850: '#1B1B24', // superficie sollevata (input, chip attivi soft)
    800: '#1E1E27', // hover / press su superficie
    700: '#262633', // bordi, divider e base dello skeleton shimmer
  },

  /** Accento primario: Electric Tangerine. */
  tangerine: {
    DEFAULT: '#FF5B22',
    soft: '#FF9A6B', // testo/icone accento su fondo scuro
    tint: '#FFB59A', // etichette dentro badge accesi
  },

  /** Note del diario: Vintage Cream Warm. */
  cream: {
    DEFAULT: '#F7F4EA', // fondo carta
    line: '#E6E0D2', // bordo carta
    ink: '#1C1917', // testo ad alto contrasto sulla carta
  },

  /** Testi su fondo scuro. */
  bone: '#F4F2ED', // testo primario (bianco caldo, non puro)
  mist: '#94A3B8', // testo secondario / placeholder

  /** Stati. */
  live: '#22C55E',
  success: '#4ADEA8',
  danger: '#F87171',
};
