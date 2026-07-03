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
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">{clinic.name}</div>
            <nav className="flex gap-1">
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
                className="text-xs text-slate-500 hover:text-slate-800"
                onClick={() => getSupabase()?.auth.signOut()}
              >
                Sign out
              </button>
            </div>
          </div>
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
