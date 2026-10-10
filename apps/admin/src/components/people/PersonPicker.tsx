import { Check } from 'lucide-react';
import { useState } from 'react';

import { useUsers } from '@/api/queries';
import type { AdminUser } from '@/api/types';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { SearchField } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { fullName } from '@/lib/people';
import { useDebounced } from '@/lib/useDebounced';

/**
 * Cerca una persona registrata per nome, email o username e la sceglie.
 * `disabledIds` sono le persone che non si possono scegliere (già nel viaggio).
 */
export function PersonPicker({
  selected,
  onSelect,
  disabledIds = [],
  disabledHint = 'Già nel viaggio',
}: {
  selected: AdminUser | null;
  onSelect: (person: AdminUser) => void;
  disabledIds?: string[];
  disabledHint?: string;
}) {
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const users = useUsers({ q, page: 0, enabled: q.length >= 2 });

  return (
    <div className="flex flex-col gap-2.5">
      <SearchField
        label="Persona"
        placeholder="Nome, email o username"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {q.length < 2 ? (
        <p className="px-1 text-[12.5px] font-semibold text-mist">Scrivi almeno due lettere.</p>
      ) : !users.data ? (
        <Skeleton className="h-[60px] rounded-[16px]" />
      ) : users.data.users.length === 0 ? (
        <p className="px-1 text-[12.5px] font-semibold text-mist">
          Nessuno con questo nome. Se non ha ancora un account, crealo da Persone.
        </p>
      ) : (
        <ul className="flex max-h-[260px] flex-col gap-1.5 overflow-y-auto" aria-label="Risultati">
          {users.data.users.map((person) => {
            const disabled = disabledIds.includes(person.id);
            const active = selected?.id === person.id;
            return (
              <li key={person.id}>
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={active}
                  onClick={() => onSelect(person)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-[16px] border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45',
                    active
                      ? 'border-tangerine bg-tangerine/10'
                      : 'border-ink-700 bg-ink-850 hover:bg-ink-800',
                  )}
                >
                  <Avatar person={person} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-extrabold text-bone">
                      {fullName(person)}
                    </span>
                    <span className="block truncate text-[12px] font-semibold text-mist">
                      {disabled ? disabledHint : (person.email ?? 'senza email')}
                    </span>
                  </span>
                  {active ? <Check size={18} strokeWidth={2.6} className="text-tangerine-soft" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
