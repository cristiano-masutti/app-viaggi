import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { TrendChart, xLabelIndexes } from './TrendChart';

const points = [
  { key: '2027-09-12', label: '12 Set', value: 4 },
  { key: '2027-09-13', label: '13 Set', value: null },
  { key: '2027-09-14', label: '14 Set', value: 7 },
];

describe('TrendChart', () => {
  it('reads every day from the keyboard, gaps included', async () => {
    const user = userEvent.setup();
    render(
      <TrendChart points={points} seriesLabel="Persone attive" format={(value) => `${value} persone`} />,
    );

    await user.tab();
    expect(screen.getByRole('img', { name: /Persone attive, 12 Set – 14 Set/ })).toHaveFocus();
    // Entrando si parte dall'ultimo giorno con un valore.
    expect(screen.getByText('14 Set: 7 persone')).toBeInTheDocument();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByText('13 Set: nessun dato')).toBeInTheDocument();

    await user.keyboard('{Home}');
    expect(screen.getByText('12 Set: 4 persone')).toBeInTheDocument();
  });

  it('breaks the line on a missing day instead of dropping it to zero', () => {
    const { container } = render(<TrendChart points={points} seriesLabel="x" format={String} />);
    // Due tratti separati: ognuno ha la sua linea, nessuno passa per il 13.
    expect(container.querySelectorAll('path.stroke-series')).toHaveLength(2);
  });

  it('labels the threshold it is drawn against', () => {
    render(
      <TrendChart
        points={points}
        seriesLabel="Avvio"
        format={String}
        threshold={{ value: 5, label: 'buono fino a 5' }}
      />,
    );
    expect(screen.getByText('buono fino a 5')).toBeInTheDocument();
  });
});

describe('xLabelIndexes', () => {
  it('keeps the first and the last day, and at most five labels', () => {
    expect(xLabelIndexes(3)).toEqual([0, 1, 2]);
    expect(xLabelIndexes(30)).toEqual([0, 7, 15, 22, 29]);
  });
});
