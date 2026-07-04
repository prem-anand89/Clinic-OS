import { useState, type FormEvent } from 'react';
import { getSupabase } from '@/lib/supabase';
import { hasSupabaseConfig } from '@/lib/env';
import { toFriendlyMessage } from '@/lib/errors';
import { Field, inputCls, btnPrimary, ErrorNote } from '@/components/ui';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!hasSupabaseConfig) {
    return (
      <div className="mx-auto mt-24 max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <h1 className="mb-2 text-base font-semibold">Supabase not configured</h1>
        <p>
          Copy <code>.env.example</code> to <code>.env</code> and fill in your Supabase project URL
          and anon key, then restart the dev server. See the README for the one-time project setup
          (migrations, seed, users).
        </p>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase()!.auth.signInWithPassword({ email, password });
    if (error) setError(toFriendlyMessage(error));
    setBusy(false);
  }

  return (
    <div className="mx-auto mt-24 max-w-sm">
      <h1 className="mb-1 text-center text-xl font-semibold text-slate-900">Clinic OS</h1>
      <p className="mb-6 text-center text-sm text-slate-500">Patient visit ledger</p>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Field label="Email">
          <input
            type="email"
            required
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <ErrorNote message={error} />
        <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-xs text-slate-500">
          First sign-in needs a connection; after that the app works offline and syncs when back
          online.
        </p>
      </form>
    </div>
  );
}
