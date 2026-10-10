// La palette è quella dell'app: un colore esiste in un posto solo,
// apps/mobile/src/theme/tokens.js, e pannello e app non possono divergere.
import tokens from '../mobile/src/theme/tokens.js';

/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        ink: tokens.ink,
        tangerine: tokens.tangerine,
        cream: tokens.cream,
        bone: tokens.bone,
        mist: tokens.mist,
        live: tokens.live,
        success: tokens.success,
        warning: tokens.warning,
        danger: tokens.danger,
      },
      borderRadius: {
        // Gli stessi raggi dell'app: card 24/28, controlli 14/18.
        card: '24px',
        hero: '28px',
        control: '18px',
        chip: '999px',
      },
    },
  },
};
