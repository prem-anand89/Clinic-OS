import { useEffect, useState } from 'react';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { getSupabase } from '@/lib/supabase';
import { syncEngine } from '@/sync/engine';
import { useSession } from './useSession';
import { ClinicContext } from './clinicContext';
import { LoginPage } from '@/features/auth/LoginPage';
import { SyncBadge } from '@/components/SyncBadge';
import { btnSecondary } from '@/components/ui';

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/visits', label: 'Visits' },
  { to: '/patients', label: 'Patients' },
  { to: '/reports', label: 'Reports' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/setup', label: 'Setup' },
] as const;

export function Shell() {
  const { loading, session } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [syncKicked, setSyncKicked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const clinics = useLiveQuery(() => db.clinics.toArray(), []);
  const activeClinicId = useLiveQuery(
    async () => (await db.meta.get('activeClinicId'))?.value ?? null,
    []
  );

  useEffect(() => {
    if (session) {
      syncEngine.start();
      syncEngine.schedule(0);
      setSyncKicked(true);
    }
  }, [session]);

  // Default the active clinic to the first membership once data arrives
  useEffect(() => {
    if (clinics?.length && activeClinicId === null) {
      void db.meta.put({ key: 'activeClinicId', value: clinics[0].id });
    }
  }, [clinics, activeClinicId]);

  // The recovery link's own auth flow doesn't need session/clinic gating —
  // it may be opened by someone whose local session has expired, and it
  // must render before those checks would otherwise redirect to login.
  if (pathname === '/reset-password') return <Outlet />;

  if (loading) return <Centered>Loading…</Centered>;
  if (!session) return <LoginPage />;

  const clinic =
    clinics?.find((c) => c.id === activeClinicId) ?? (clinics?.length === 1 ? clinics[0] : null);

  if (!clinic) {
    return (
      <Centered>
        <div className="max-w-md space-y-3 text-center text-sm text-slate-600">
          <p className="text-base font-medium text-slate-800">
            {syncKicked ? 'Fetching your clinic…' : 'Preparing…'}
          </p>
          <p>
            If this is a fresh setup, make sure the migrations + seed ran and your user was added
            to the clinic (see <code>supabase/setup_members.sql</code>), then sync again.
          </p>
          <button className={btnSecondary} onClick={() => syncEngine.schedule(0)}>
            Retry sync
          </button>
          <button className={btnSecondary} onClick={() => getSupabase()?.auth.signOut()}>
            Sign out
          </button>
        </div>
      </Centered>
    );
  }

  // Print views render without app chrome
  if (pathname.endsWith('/print')) {
    return (
      <ClinicContext.Provider value={clinic}>
        <Outlet />
      </ClinicContext.Provider>
    );
  }

  return (
    <ClinicContext.Provider value={clinic}>
      <div className="min-h-screen bg-slate-50">
        <header className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            <div className="truncate text-sm font-semibold text-slate-900">{clinic.name}</div>
            {/* Desktop nav */}
            <nav className="hidden gap-1 sm:flex">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 [&.active]:bg-slate-100 [&.active]:font-medium [&.active]:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <SyncBadge />
              <button
                className="hidden text-xs text-slate-500 hover:text-slate-800 sm:block"
                onClick={() => getSupabase()?.auth.signOut()}
              >
                Sign out
              </button>
              {/* Mobile menu toggle */}
              <button
                className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 sm:hidden"
                aria-label="Menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  {menuOpen ? (
                    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  ) : (
                    <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  )}
                </svg>
              </button>
            </div>
          </div>
          {/* Mobile nav panel */}
          {menuOpen && (
            <nav className="border-t border-slate-200 bg-white px-2 py-2 sm:hidden">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 [&.active]:bg-slate-100 [&.active]:font-medium [&.active]:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
              <button
                className="mt-1 block w-full rounded-md px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100"
                onClick={() => getSupabase()?.auth.signOut()}
              >
                Sign out
              </button>
            </nav>
          )}
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">
          <Outlet />
        </main>
      </div>
    </ClinicContext.Provider>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center">{children}</div>;
}
