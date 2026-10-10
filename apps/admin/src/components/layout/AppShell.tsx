import { Backpack, LayoutDashboard, LogOut, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';

import type { AdminSession } from '@/api/types';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { fullName } from '@/lib/people';

import { BrandMark } from './BrandMark';

const NAV = [
  { to: '/', label: 'Panoramica', Icon: LayoutDashboard, end: true },
  { to: '/viaggi', label: 'Viaggi', Icon: Backpack, end: false },
  { to: '/persone', label: 'Persone', Icon: Users, end: false },
] as const;

/**
 * La cornice del pannello. Su desktop una colonna a sinistra con le tre
 * sezioni; su telefono la barra flottante in basso, la stessa dell'app.
 */
export function AppShell({ admin, onSignOut }: { admin: AdminSession; onSignOut: () => void }) {
  return (
    <div className="min-h-dvh bg-ink-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-ink-700 bg-ink-950 px-4 py-6 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <BrandMark />
          <div className="leading-tight">
            <p className="text-[16px] font-extrabold tracking-tight text-white">Vibemakers</p>
            <p className="text-[12px] font-semibold text-mist">Pannello di controllo</p>
          </div>
        </div>

        <nav aria-label="Sezioni" className="mt-9 flex flex-col gap-1">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group flex h-12 items-center gap-3 rounded-control px-3.5 text-[14.5px] font-extrabold tracking-tight transition-colors',
                  isActive ? 'bg-tangerine/12 text-white' : 'text-bone/70 hover:bg-ink-900 hover:text-bone',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={20}
                    strokeWidth={2.2}
                    className={isActive ? 'text-tangerine-soft' : undefined}
                  />
                  {label}
                  {isActive ? (
                    <span className="ml-auto h-2 w-2 rounded-full bg-tangerine" aria-hidden />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex items-center gap-3 rounded-[20px] border border-ink-700 bg-ink-900 p-3">
          <Avatar person={admin} size={38} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13.5px] font-extrabold text-bone">{fullName(admin)}</p>
            <p className="truncate text-[12px] font-semibold text-mist">Staff</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Esci"
            title="Esci"
            className="flex h-9 w-9 items-center justify-center rounded-[12px] text-bone/60 hover:bg-ink-800 hover:text-bone"
          >
            <LogOut size={17} strokeWidth={2.2} />
          </button>
        </div>
      </aside>

      <main className="pb-32 lg:pb-12 lg:pl-[264px]">
        <Outlet />
      </main>

      {/* Telefono: la barra flottante dell'app, vetro scuro e icone; l'attiva in rosso. */}
      <nav
        aria-label="Sezioni"
        className="fixed inset-x-0 bottom-0 z-30 px-5 pt-2 pb-[max(14px,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="flex min-h-[60px] overflow-hidden rounded-[24px] border border-ink-700 bg-ink-900/70 shadow-card backdrop-blur-xl">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              aria-label={label}
              className="flex flex-1 flex-col items-center justify-center gap-1"
            >
              {({ isActive }) => (
                <>
                  <Icon size={23} strokeWidth={2.2} className={isActive ? 'text-tangerine' : 'text-bone'} />
                  <span
                    className={cn(
                      'text-[10.5px] font-bold',
                      isActive ? 'text-tangerine-soft' : 'text-bone/55',
                    )}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
