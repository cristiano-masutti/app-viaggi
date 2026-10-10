import { Check, Copy, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { errorMessage } from '@/api/client';
import { PAGE_SIZE, useCreateAccount, useUsers } from '@/api/queries';
import type { AdminUser, CreatedAccount } from '@/api/types';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { SlotForm } from '@/components/plan/SlotForm';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, SearchField } from '@/components/ui/Field';
import { Pager } from '@/components/ui/Pager';
import { QueryError } from '@/components/ui/QueryError';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { useToast } from '@/components/ui/Toast';
import { dayOf } from '@/lib/dates';
import { fullName } from '@/lib/people';
import { pageFromParams, pageParam, withParams } from '@/lib/searchParams';
import { useDebounced } from '@/lib/useDebounced';

/** Gli account dell'organizzazione: chi li ha, da quando, in quanti viaggi. */
export function PeoplePage() {
  const [params, setParams] = useSearchParams();
  const page = pageFromParams(params);
  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDebounced(search.trim());
  const [creating, setCreating] = useState(false);
  const users = useUsers({ q, page });

  const update = (next: { q?: string; pagina?: number }) =>
    setParams(withParams(params, { q: next.q, pagina: pageParam(next.pagina) }), { replace: true });

  return (
    <>
      <PageHeader
        title="Persone"
        subtitle="Gli account dell'organizzazione e i loro viaggi 🎒"
        actions={
          <Button icon={<UserPlus size={18} strokeWidth={2.4} />} onClick={() => setCreating(true)}>
            Crea account
          </Button>
        }
      >
        <SearchField
          aria-label="Cerca una persona"
          placeholder="Nome, email o username"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            update({ q: event.target.value.trim(), pagina: 0 });
          }}
          className="max-w-[520px]"
        />
      </PageHeader>

      <PageBody>
        {users.isError ? (
          <QueryError error={users.error} onRetry={() => void users.refetch()} />
        ) : !users.data ? (
          <Card className="flex flex-col gap-3 p-4">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-[52px] rounded-[16px]" />
            ))}
          </Card>
        ) : users.data.users.length === 0 ? (
          q ? (
            <EmptyState emoji="🔎" title="Nessuno trovato" hint={`Niente corrisponde a “${q}”.`} />
          ) : (
            <EmptyState
              emoji="👋"
              title="Ancora nessun account"
              hint="Crea il primo: la persona riceve da te email e password provvisoria per entrare nell'app."
            />
          )
        ) : (
          <div className={users.isPlaceholderData ? 'flex flex-col gap-3 opacity-60' : 'flex flex-col gap-3'}>
            <Card className="divide-y divide-ink-700 overflow-hidden">
              {users.data.users.map((person) => (
                <PersonRow key={person.id} person={person} />
              ))}
            </Card>
            <Pager
              page={page}
              pageSize={PAGE_SIZE}
              total={users.data.total}
              onPage={(next) => update({ pagina: next })}
            />
          </div>
        )}
      </PageBody>

      {creating ? <CreateAccountDialog onClose={() => setCreating(false)} /> : null}
    </>
  );
}

function PersonRow({ person }: { person: AdminUser }) {
  return (
    <Link
      to={`/persone/${person.id}`}
      className="grid items-center gap-3 p-4 transition-colors hover:bg-ink-850 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <Avatar person={person} />
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-[14.5px] font-extrabold text-bone">{fullName(person)}</span>
            {person.isAdmin ? (
              <span className="rounded-chip bg-tangerine/15 px-2 py-0.5 text-[10.5px] font-extrabold tracking-wide text-tangerine-tint uppercase">
                Staff
              </span>
            ) : null}
          </span>
          <span className="block truncate text-[12.5px] font-semibold text-mist">
            {person.username ? `@${person.username} · ` : ''}
            {person.email ?? 'senza email'}
          </span>
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2 text-[12.5px] font-bold text-bone/70">
        <span className="tabular-nums">
          {person.tripCount} {person.tripCount === 1 ? 'viaggio' : 'viaggi'}
        </span>
        <span className="text-bone/30">·</span>
        <span>dal {dayOf(person.createdAt)}</span>
      </span>
      <span>
        {person.passport.present ? (
          <StatusChip status="ok" label="Passaporto" />
        ) : (
          <StatusChip status="bad" label="Senza passaporto" />
        )}
      </span>
    </Link>
  );
}

/**
 * Nuovo account: email e nome. La password provvisoria si vede una volta sola,
 * qui, per consegnarla alla persona; poi resta solo su Supabase.
 */
function CreateAccountDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateAccount();
  const toast = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [created, setCreated] = useState<CreatedAccount | null>(null);
  const [copied, setCopied] = useState(false);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  if (created) {
    const message = `Ciao ${created.user.firstName}! Il tuo accesso a Vibemakers:\nEmail: ${created.user.email}\nPassword provvisoria: ${created.temporaryPassword}`;
    return (
      <Dialog
        open
        onClose={onClose}
        title="Account creato ✅"
        subtitle={`${fullName(created.user)} · ${created.user.email}`}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-[18px] border border-tangerine/40 bg-tangerine/10 p-4">
            <span className="text-[10.5px] font-bold tracking-[0.8px] text-bone/55 uppercase">
              Password provvisoria
            </span>
            <code className="font-mono text-[22px] font-bold tracking-wide text-white">
              {created.temporaryPassword}
            </code>
          </div>
          <p className="text-[13px] leading-[20px] font-semibold text-mist">
            Consegnala a {created.user.firstName} di persona o in un messaggio privato: non verrà mostrata di
            nuovo. Con email e password entra nell'app.
          </p>
          <Button
            icon={copied ? <Check size={17} strokeWidth={2.6} /> : <Copy size={16} strokeWidth={2.2} />}
            onClick={() =>
              void navigator.clipboard
                .writeText(message)
                .then(() => setCopied(true))
                .catch(() => toast.show('Copia non riuscita: ricopiala a mano', 'error'))
            }
          >
            {copied ? 'Messaggio copiato' : 'Copia il messaggio per la persona'}
          </Button>
          <Link
            to={`/persone/${created.user.id}`}
            onClick={onClose}
            className="text-center text-[13.5px] font-extrabold text-tangerine-soft hover:underline"
          >
            Apri la scheda di {created.user.firstName}
          </Link>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Crea account"
      subtitle="Le credenziali le fornisce l'organizzazione: l'app non ha una registrazione"
    >
      <SlotForm
        canSave={!!firstName.trim() && !!lastName.trim() && validEmail}
        saving={create.isPending}
        saveLabel="Crea account"
        onSubmit={() =>
          create.mutate(
            { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() },
            {
              onSuccess: (account) => setCreated(account),
              onError: (error) => toast.show(errorMessage(error), 'error'),
            },
          )
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Nome"
            autoComplete="off"
            value={firstName}
            maxLength={60}
            onChange={(event) => setFirstName(event.target.value)}
          />
          <Field
            label="Cognome"
            autoComplete="off"
            value={lastName}
            maxLength={60}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>
        <Field
          label="Email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={email && !validEmail ? "Non sembra un'email." : null}
        />
      </SlotForm>
    </Dialog>
  );
}
