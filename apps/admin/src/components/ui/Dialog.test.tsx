import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Dialog } from './Dialog';

function Page({ onClose = () => undefined }: { onClose?: () => void }) {
  return (
    <>
      <div id="root">
        <button type="button">Dietro al foglio</button>
      </div>
      <Dialog open onClose={onClose} title="Nuovo viaggio">
        <input aria-label="Titolo" />
        <button type="button">Salva</button>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('keeps the keyboard inside: Tab goes round the sheet and never behind it', async () => {
    const user = userEvent.setup();
    render(<Page />);

    expect(screen.getByLabelText('Titolo')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Salva' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Chiudi' })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Titolo')).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Chiudi' })).toHaveFocus();
  });

  it('closes with Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Page onClose={onClose} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
