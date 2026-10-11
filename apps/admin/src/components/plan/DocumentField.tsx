import { FileText, Paperclip, RotateCcw, Trash2 } from 'lucide-react';
import { useRef } from 'react';

import { ACCEPTED_FILES, type DocumentChange } from '@/api/documents';
import type { TripDocument } from '@/api/types';

const MAX_MB = 15;

/** "248 KB", "3,1 MB" */
export function fileSize(bytes: number | null | undefined) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/**
 * L'allegato di uno slot, come nel foglio di modifica dell'app: il file
 * attuale, "Sostituisci" e "Rimuovi". Non carica niente da solo: dice cosa
 * fare al salvataggio (`DocumentChange`), così annullare non lascia file orfani.
 */
export function DocumentField({
  label,
  current,
  change,
  onChange,
}: {
  label: string;
  current: TripDocument | null | undefined;
  change: DocumentChange;
  onChange: (change: DocumentChange) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const shown =
    change.kind === 'upload'
      ? { name: change.file.name, size: change.file.size, pending: true }
      : change.kind === 'keep' && current
        ? { name: current.originalName ?? current.title, size: current.sizeBytes, pending: false }
        : null;
  const tooBig = change.kind === 'upload' && change.file.size > MAX_MB * 1024 * 1024;

  return (
    <div className="flex flex-col gap-2 rounded-[16px] border border-ink-700 bg-ink-850 px-4 py-3.5">
      <span className="text-[10.5px] font-bold tracking-[0.8px] text-bone/60 uppercase">{label}</span>
      {shown ? (
        <div className="flex items-center gap-2.5">
          <FileText size={16} strokeWidth={2} className="shrink-0 text-tangerine-soft" />
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-bone">
            {shown.name}
            <span className="ml-2 font-semibold text-mist">
              {fileSize(shown.size)}
              {shown.pending ? ' · da caricare' : ''}
            </span>
          </span>
          {change.kind === 'upload' ? (
            <button
              type="button"
              aria-label="Annulla il nuovo file"
              onClick={() => onChange({ kind: 'keep' })}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink-700 bg-ink-900 text-bone/70 hover:text-bone"
            >
              <RotateCcw size={14} strokeWidth={2.2} />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Rimuovi allegato"
              onClick={() => onChange({ kind: 'remove' })}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink-700 bg-ink-900 text-danger hover:bg-danger/10"
            >
              <Trash2 size={14} strokeWidth={2} />
            </button>
          )}
        </div>
      ) : change.kind === 'remove' && current ? (
        <p className="text-[12.5px] font-semibold text-mist">
          L'allegato verrà tolto al salvataggio.{' '}
          <button
            type="button"
            className="font-bold text-tangerine-soft hover:underline"
            onClick={() => onChange({ kind: 'keep' })}
          >
            Annulla
          </button>
        </p>
      ) : null}
      {tooBig ? <p className="text-[12.5px] font-bold text-danger">Il file supera {MAX_MB} MB.</p> : null}
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex h-11 items-center justify-center gap-2 rounded-[14px] border border-ink-700 bg-ink-900 text-[13.5px] font-extrabold text-bone hover:bg-ink-800"
      >
        <Paperclip size={15} strokeWidth={2} />
        {shown ? 'Sostituisci file' : 'Allega PDF o immagine'}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED_FILES}
        className="hidden"
        aria-label={`File per ${label}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onChange({ kind: 'upload', file });
          event.target.value = '';
        }}
      />
    </div>
  );
}

/** Il file collegato si può aprire anche fuori dal foglio di modifica. */
export function DocumentChip({
  document,
  label,
  onOpen,
}: {
  document: TripDocument;
  label: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!document.hasFile}
      title={document.originalName ?? document.title}
      className="inline-flex max-w-full items-center gap-2 self-start rounded-[12px] border border-ink-700 bg-ink-850 px-3 py-2 text-[12.5px] font-bold text-bone hover:bg-ink-800 disabled:cursor-default disabled:opacity-70"
    >
      <span aria-hidden>📄</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
