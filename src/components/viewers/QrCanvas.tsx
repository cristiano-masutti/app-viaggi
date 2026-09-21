import React, { useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';

import { palette } from '@/theme/palette';

const MODULES = 25;

/** PRNG deterministico: lo stesso codice disegna sempre lo stesso QR. */
function seeded(seed: string) {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1000) / 1000;
  };
}

/** I tre quadrati d'angolo che rendono un QR riconoscibile a colpo d'occhio. */
const isFinder = (row: number, col: number) => {
  const inBox = (r0: number, c0: number) => row >= r0 && row < r0 + 7 && col >= c0 && col < c0 + 7;
  return inBox(0, 0) || inBox(0, MODULES - 7) || inBox(MODULES - 7, 0);
};

const finderFilled = (row: number, col: number) => {
  const r = row < 7 ? row : row - (MODULES - 7);
  const c = col < 7 ? col : col - (MODULES - 7);
  const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
  return ring !== 2;
};

interface Props {
  /** Codice pratica: determina il disegno. */
  value: string;
  size?: number;
}

/**
 * QR di prototipazione.
 *
 * Disegnato con `react-native-svg` a partire dal codice pratica: non è
 * scansionabile, ma è stabile nel tempo e ha la densità giusta per valutare
 * leggibilità e contrasto del viewer. Quando arriverà il backend basta
 * sostituire questo componente con il PNG firmato del fornitore.
 */
export function QrCanvas({ value, size = 232 }: Props) {
  const cells = useMemo(() => {
    const random = seeded(value);
    const grid: boolean[][] = [];
    for (let row = 0; row < MODULES; row += 1) {
      const line: boolean[] = [];
      for (let col = 0; col < MODULES; col += 1) {
        if (isFinder(row, col)) line.push(finderFilled(row, col));
        // Riga e colonna di sincronismo.
        else if (row === 6 || col === 6) line.push((row + col) % 2 === 0);
        else line.push(random() > 0.48);
      }
      grid.push(line);
    }
    return grid;
  }, [value]);

  const module = size / MODULES;

  return (
    <Svg width={size} height={size} accessibilityLabel={`Codice QR ${value}`}>
      <Rect x={0} y={0} width={size} height={size} fill={palette.cream} />
      {cells.map((line, row) =>
        line.map((filled, col) =>
          filled ? (
            <Rect
              key={`${row}-${col}`}
              x={col * module}
              y={row * module}
              width={module}
              height={module}
              fill={palette.creamInk}
            />
          ) : null,
        ),
      )}
    </Svg>
  );
}
