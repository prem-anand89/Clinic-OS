import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { repos, patientService } from '@/services';
import { useClinic } from '@/app/clinicContext';
import type { Patient } from '@/domain/types';
import { inputCls, Pill, td, th } from '@/components/ui';
import { applySort, byNumber, byString, SortHeader, useSort } from '@/components/sortable';
import { toFriendlyMessage } from '@/lib/errors';

type SortKey = 'name' | 'mrno' | 'age' | 'condition';

const COMPARATORS = {
  name: byString<Patient>((p) => p.name),
  mrno: byString<Patient>((p) => p.mrno),
  age: byNumber<Patient>((p) => p.age ?? -1),
  condition: byString<Patient>((p) => p.primaryCondition ?? ''),
};

export function PatientsPage() {
  const clinic = useClinic();
  const [query, setQuery] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sort = useSort<SortKey>('name');

  const all = useLiveQuery(() => repos.patients.list(clinic.id), [clinic.id]);

  const q = query.trim().toLowerCase();
  const active = (all ?? []).filter(
    (p) =>
      !p.deletedAt &&
      (!q || p.mrno.toLowerCase().startsWith(q) || p.name.toLowerCase().includes(q))
  );
  const hidden = (all ?? []).filter((p) => p.deletedAt);
  const rows = applySort(active, COMPARATORS, sort);

  async function hide(p: Patient) {
    if (
      !confirm(
        `Hide ${p.name} (${p.mrno})?\n\nThey disappear from search and pickers; their visits stay in the records. You can restore them anytime from "Hidden patients" below.`
      )
    )
      return;
    setError(null);
    try {
      await patientService.hide(p.id);
    } catch (e) {
      setError(toFriendlyMessage(e));
    }
  }

  async function restore(p: Patient) {
    setError(null);
    try {
      await patientService.restore(p.id);
    } catch (e) {
      setError(toFriendlyMessage(e));
    }
  }

  async function hardDelete(p: Patient) {
    setError(null);
    try {
      const visits = await repos.visits.list({ clinicId: clinic.id, patientId: p.id });
      if (visits.length > 0) {
        alert(
          `${p.name} has ${visits.length} visit(s) on record, so they can't be permanently deleted — keep them hidden instead.`
        );
        return;
      }
      const typed = prompt(
        `Permanently delete ${p.name} (${p.mrno})? This cannot be undone.\n\nType the patient's name to confirm:`
      );
      if (typed === null) return;
      if (typed.trim().toLowerCase() !== p.name.trim().toLowerCase()) {
        alert('Name did not match — nothing was deleted.');
        return;
      }
      await patientService.hardDelete(p.id);
    } catch (e) {
      setError(toFriendlyMessage(e));
    }
  }

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

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <SortHeader label="MRNO" k="mrno" sort={sort} />
              <SortHeader label="Name" k="name" sort={sort} />
              <SortHeader label="Age / Sex" k="age" sort={sort} />
              <SortHeader label="Primary condition" k="condition" sort={sort} />
              <th className={th}>Phone</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((p) => (
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
                <td className={`${td} whitespace-nowrap`}>
                  <Link
                    to="/visits"
                    search={{ patientId: p.id }}
                    className="text-blue-600 hover:underline"
                  >
                    Visit history
                  </Link>
                  <button
                    className="ml-3 text-xs text-slate-400 hover:text-amber-600"
                    onClick={() => void hide(p)}
                  >
                    Hide
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">
                  {q ? 'No patients match your search.' : 'No patients yet — they’re created from the “New visit” flow.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hidden.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <button
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setShowHidden((s) => !s)}
          >
            <span>Hidden patients ({hidden.length})</span>
            <span className="text-xs text-slate-400">{showHidden ? 'Collapse' : 'Show'}</span>
          </button>
          {showHidden && (
            <table className="min-w-full divide-y divide-slate-200 border-t border-slate-200">
              <tbody className="divide-y divide-slate-100">
                {hidden.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className={td}>
                      {p.name} <span className="text-xs text-slate-400">{p.mrno}</span>
                    </td>
                    <td className={td}>
                      <Pill tone="slate">Hidden {p.deletedAt?.slice(0, 10)}</Pill>
                    </td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      <button
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => void restore(p)}
                      >
                        Restore
                      </button>
                      <button
                        className="ml-3 text-xs text-slate-400 hover:text-red-600"
                        onClick={() => void hardDelete(p)}
                      >
                        Delete permanently
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
