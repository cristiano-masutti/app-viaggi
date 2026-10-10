/** Unisce classi Tailwind ignorando i valori falsi: `cn('a', active && 'b')`. */
export const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');
