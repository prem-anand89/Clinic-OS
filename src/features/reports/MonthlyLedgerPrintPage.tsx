import { useMemo } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { repos, reportService } from '@/services';
import { useClinic } from '@/app/clinicContext';
import { getSupabase } from '@/lib/supabase';
import { formatINR } from '@/domain/money';
import { fiscalYearOf, monthDateRange, monthName } from '@/domain/fiscalYear';
import { btnPrimary, btnSecondary } from '@/components/ui';
import { MonthlyReportTable } from '@/components/MonthlyReportTable';

function publicLogoUrl(path: string | null): string | null {
  if (!path) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  return supabase.storage.from('clinic-assets').getPublicUrl(path).data.publicUrl;
}

function dayOfWeek(visitDate: string): string {
  return new Date(`${visitDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
}

export function MonthlyLedgerPrintPage() {
  const clinic = useClinic();
  const { year, month } = useSearch({ strict: false }) as { year: number; month: number };
  const period = { year, month };
  const fy = fiscalYearOf(new Date(period.year, period.month - 1, 1), clinic.fyStartMonth);

  const visits = useLiveQuery(() => {
    const { from, to } = monthDateRange(period);
    return repos.visits.list({ clinicId: clinic.id, from, to });
  }, [clinic.id, period.year, period.month]);
  const patients = useLiveQuery(() => repos.patients.list(clinic.id), [clinic.id]);
  const therapists = useLiveQuery(() => repos.therapists.list(clinic.id, true), [clinic.id]);
  const catalog = useLiveQuery(() => repos.catalog.list(clinic.id, true), [clinic.id]);
  const report = useLiveQuery(() => reportService.monthly(clinic.id, period), [clinic.id, period.year, period.month]);

  const patientById = useMemo(() => new Map((patients ?? []).map((p) => [p.id, p])), [patients]);
  const therapistName = useMemo(
    () => new Map((therapists ?? []).map((t) => [t.id, t.name])),
    [therapists]
  );
  const serviceName = useMemo(() => new Map((catalog ?? []).map((c) => [c.id, c.name])), [catalog]);

  const sortedVisits = useMemo(
    () => [...(visits ?? [])].sort((a, b) => a.visitDate.localeCompare(b.visitDate)),
    [visits]
  );

  const logoUrl = useMemo(() => publicLogoUrl(clinic.logoPath), [clinic.logoPath]);
  const partnerLogoUrl = useMemo(
    () => publicLogoUrl(clinic.partnerHospitalLogoPath),
    [clinic.partnerHospitalLogoPath]
  );

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{`@page { size: A4 landscape; margin: 12mm; }`}</style>

      <div className="no-print mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
        <Link to="/reports" className={btnSecondary}>
          ← Back
        </Link>
        <button className={`${btnPrimary} ml-auto`} onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>

      <div className="mx-auto max-w-6xl bg-white p-8 shadow print:max-w-none print:p-0 print:shadow-none">
        {/* Letterhead */}
        <header className="flex items-start justify-between border-b border-slate-300 pb-4">
          <div className="flex items-center gap-3">
            {logoUrl && <img src={logoUrl} alt="" className="h-14 w-auto object-contain" />}
            <div>
              <h1 className="text-xl font-bold text-slate-900">{clinic.name}</h1>
              {clinic.address && <p className="text-xs text-slate-600">{clinic.address}</p>}
              <p className="text-xs text-slate-600">
                {[clinic.phone, clinic.email].filter(Boolean).join(' · ')}
              </p>
              {clinic.gstNo && <p className="text-xs text-slate-600">GSTIN: {clinic.gstNo}</p>}
            </div>
          </div>
          {clinic.partnerHospitalName && (
            <div className="flex items-center gap-2 text-right">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">In partnership with</p>
                <p className="text-sm font-medium text-slate-700">{clinic.partnerHospitalName}</p>
              </div>
              {partnerLogoUrl && (
                <img src={partnerLogoUrl} alt="" className="h-10 w-auto object-contain" />
              )}
            </div>
          )}
        </header>

        <div className="mt-4 flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-slate-900">Monthly Visit Ledger</h2>
          <p className="text-sm text-slate-600">
            {monthName(period.month)} {period.year} · FY {fy.label}
          </p>
        </div>

        {/* Per-visit table */}
        <table className="mt-4 w-full text-xs">
          <thead>
            <tr className="border-b border-slate-300 text-left uppercase tracking-wide text-slate-500">
              <th className="py-1.5 pr-2">SN</th>
              <th className="py-1.5 pr-2">Date</th>
              <th className="py-1.5 pr-2">Day</th>
              <th className="py-1.5 pr-2">Patient</th>
              <th className="py-1.5 pr-2">MRNO</th>
              <th className="py-1.5 pr-2">Age/Sex</th>
              <th className="py-1.5 pr-2">Condition</th>
              <th className="py-1.5 pr-2">Therapist</th>
              <th className="py-1.5 pr-2">Service</th>
              <th className="py-1.5 text-right">Bill Amount</th>
            </tr>
          </thead>
          <tbody>
            {sortedVisits.map((v, i) => {
              const p = patientById.get(v.patientId);
              return (
                <tr key={v.id} className="border-b border-slate-100">
                  <td className="py-1 pr-2 text-slate-500">{i + 1}</td>
                  <td className="py-1 pr-2">{v.visitDate}</td>
                  <td className="py-1 pr-2 text-slate-500">{dayOfWeek(v.visitDate)}</td>
                  <td className="py-1 pr-2 font-medium text-slate-800">{p?.name ?? '—'}</td>
                  <td className="py-1 pr-2">{p?.mrno ?? '—'}</td>
                  <td className="py-1 pr-2">
                    {p?.age ?? '—'} / {p?.sex ?? '—'}
                  </td>
                  <td className="py-1 pr-2">{v.condition ?? '—'}</td>
                  <td className="py-1 pr-2">{therapistName.get(v.therapistId) ?? '—'}</td>
                  <td className="py-1 pr-2">
                    {serviceName.get(v.serviceCatalogId) ?? '—'}
                    {v.sessionIndex && v.packageTotal && (
                      <span className="ml-1 text-slate-400">
                        {v.sessionIndex}/{v.packageTotal}
                      </span>
                    )}
                  </td>
                  <td className="py-1 text-right tabular-nums">{formatINR(v.actualBillPaise)}</td>
                </tr>
              );
            })}
            {sortedVisits.length === 0 && (
              <tr>
                <td colSpan={10} className="py-6 text-center text-slate-400">
                  No visits in this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Per-therapist summary */}
        <h2 className="mt-8 text-sm font-bold text-slate-900">Monthly Summary</h2>
        <div className="mt-2 overflow-x-auto">
          <MonthlyReportTable report={report} />
        </div>

        <footer className="mt-8 border-t border-slate-200 pt-3 text-xs text-slate-400">
          Generated {new Date().toISOString().slice(0, 10)} · {clinic.name}
          {clinic.partnerHospitalName ? ` — ${clinic.partnerHospitalName}` : ''}
        </footer>
      </div>
    </div>
  );
}
