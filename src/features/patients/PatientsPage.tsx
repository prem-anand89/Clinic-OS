import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { repos } from '@/services';
import { useClinic } from '@/app/clinicContext';
import { inputCls, Pill, th, td } from '@/components/ui';

export function PatientsPage() {
  const clinic = useClinic();
  const [query, setQuery] = useState('');

  const patients = useLiveQuery(async () => {
    if (query.trim()) return repos.patients.search(clinic.id, query, 100);
    return repos.patients.list(clinic.id);
  }, [clinic.id, query]);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Patients</h1>
        <input
          className={`${inputCls} ml-auto max-w-xs`}
          placeholder="Search by MRNO or name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>MRNO</th>
              <th className={th}>Name</th>
              <th className={th}>Age / Sex</th>
              <th className={th}>Primary condition</th>
              <th className={th}>Phone</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(patients ?? []).map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className={td}>
                  {p.mrno}
                  {p.mrnoSource === 'auto' && (
                    <span className="ml-1.5">
                      <Pill tone="slate">walk-in</Pill>
                    </span>
                  )}
                </td>
                <td className={td}>{p.name}</td>
                <td className={td}>
                  {p.age ?? '—'} / {p.sex ?? '—'}
                </td>
                <td className={td}>{p.primaryCondition ?? '—'}</td>
                <td className={td}>{p.phone ?? '—'}</td>
                <td className={td}>
                  <Link
                    to="/visits"
                    search={{ patientId: p.id }}
                    className="text-blue-600 hover:underline"
                  >
                    Visit history
                  </Link>
                </td>
              </tr>
            ))}
            {patients?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">
                  No patients yet — they're created from the “New visit” flow.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
