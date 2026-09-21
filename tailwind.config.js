const tokens = require('./src/theme/tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
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
        danger: tokens.danger,
      },
      borderRadius: {
        // Raggi "premium": le card stanno su 24/28, i controlli su 14/18.
        card: '24px',
        hero: '28px',
        control: '18px',
        chip: '999px',
      },
    },
  },
  plugins: [],
};
