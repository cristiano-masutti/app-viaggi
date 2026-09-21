/// <reference types="nativewind/types" />

/**
 * `global.css` è il punto d'ingresso di Tailwind: viene importato per effetto
 * collaterale in `App.tsx` e trasformato da Metro, non da TypeScript.
 */
declare module '*.css';
