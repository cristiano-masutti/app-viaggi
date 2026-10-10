import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { type DocumentChange, KEEP } from '@/api/documents';
import type { TripDocument } from '@/api/types';

import { DocumentField, fileSize } from './DocumentField';

const voucher: TripDocument = {
  id: 'doc-1',
  kind: 'pdf',
  title: 'Voucher',
  subtitle: 'voucher-kria.pdf',
  code: '',
  hasFile: true,
  originalName: 'voucher-kria.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 254_000,
  createdAt: '2027-09-01T10:00:00.000Z',
};

function Harness({ current }: { current: TripDocument | null }) {
  const [change, setChange] = useState<DocumentChange>(KEEP);
  return (
    <>
      <DocumentField label="Voucher di prenotazione" current={current} change={change} onChange={setChange} />
      <output>{change.kind}</output>
    </>
  );
}

describe('DocumentField', () => {
  it('shows the attached file, and only marks it for removal until saved', async () => {
    const user = userEvent.setup();
    render(<Harness current={voucher} />);

    expect(screen.getByText('voucher-kria.pdf')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rimuovi allegato' }));
    expect(screen.getByRole('status')).toHaveTextContent('remove');
    expect(screen.getByText(/verrà tolto al salvataggio/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(screen.getByRole('status')).toHaveTextContent('keep');
  });

  it('holds a newly picked file until saved, and can go back to the old one', async () => {
    const user = userEvent.setup();
    render(<Harness current={voucher} />);

    await user.upload(
      screen.getByLabelText('File per Voucher di prenotazione'),
      new File(['%PDF'], 'nuovo.pdf', { type: 'application/pdf' }),
    );
    expect(screen.getByText('nuovo.pdf')).toBeInTheDocument();
    expect(screen.getByText(/da caricare/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('upload');

    await user.click(screen.getByRole('button', { name: 'Annulla il nuovo file' }));
    expect(screen.getByText('voucher-kria.pdf')).toBeInTheDocument();
  });

  it('offers to attach a file when there is none', () => {
    render(<Harness current={null} />);
    expect(screen.getByRole('button', { name: /Allega PDF o immagine/ })).toBeInTheDocument();
  });
});

describe('fileSize', () => {
  it('reads like a person would say it', () => {
    expect(fileSize(254_000)).toBe('248 KB');
    expect(fileSize(3_250_000)).toBe('3,1 MB');
    expect(fileSize(null)).toBe('');
  });
});
