import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { reportService } from '@/services';
import { useClinic } from '@/app/clinicContext';
import { formatINR } from '@/domain/money';
import { fiscalYearOf, monthsOfFiscalYear, monthName } from '@/domain/fiscalYear';
import { btnSecondary, inputCls, th, thNum, td, tdNum } from '@/components/ui';
import type { TherapistMonthRow } from '@/services/reportService';

export function ReportsPage() {
  const clinic = useClinic();
  const currentFy = fiscalYearOf(new Date(), clinic.fyStartMonth);
  const [fyStartYear, setFyStartYear] = useState(currentFy.startYear);
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${now.getMonth() + 1}`);

  const months = useMemo(
    () => monthsOfFiscalYear(fyStartYear, clinic.fyStartMonth),
    [fyStartYear, clinic.fyStartMonth]
  );

  const selected = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return { year: y, month: m };
  }, [month]);

  const report = useLiveQuery(
    () => reportService.monthly(clinic.id, selected),
    [clinic.id, selected.year, selected.month]
  );

  function downloadCsv() {
    if (!report) return;
    const blob = new Blob([reportService.toCsv(report)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${clinic.invoicePrefix}-report-${selected.year}-${String(selected.month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cells = (r: TherapistMonthRow) => (
    <>
      <td className={tdNum}>{formatINR(r.billPaise)}</td>
      <td className={tdNum}>{formatINR(r.bmSharePaise)}</td>
      <td className={tdNum}>{formatINR(r.tdsPaise)}</td>
      <td className={tdNum}>{formatINR(r.postTaxPaise)}</td>
      <td className={tdNum}>{formatINR(r.hvPaise)}</td>
      <td className={tdNum}>{r.adjustmentPaise !== 0 ? formatINR(r.adjustmentPaise) : '—'}</td>
      <td className={tdNum}>{r.visitCount}</td>
      <td className={tdNum}>{r.uniquePatients}</td>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Monthly report</h1>
        <div className="ml-auto flex items-end gap-2">
          <select
            className={inputCls}
            value={fyStartYear}
            onChange={(e) => setFyStartYear(Number(e.target.value))}
          >
            {[currentFy.startYear - 2, currentFy.startYear - 1, currentFy.startYear].map((y) => (
              <option key={y} value={y}>
                FY {fiscalYearOf(new Date(y, clinic.fyStartMonth - 1, 1), clinic.fyStartMonth).label}
              </option>
            ))}
          </select>
          <select className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                {monthName(m.month)} {m.year}
              </option>
            ))}
          </select>
          <button className={btnSecondary} onClick={downloadCsv}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Therapist</th>
              <th className={thNum}>Bill Amount</th>
              <th className={thNum}>BM Share</th>
              <th className={thNum}>TDS Deducted</th>
              <th className={thNum}>Post Tax BM</th>
              <th className={thNum}>HV Share</th>
              <th className={thNum}>Adjustments</th>
              <th className={thNum}>Visits</th>
              <th className={thNum}>Patients</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(report?.rows ?? []).map((r) => (
              <tr key={r.therapistId}>
                <td className={td}>{r.therapistName}</td>
                {cells(r)}
              </tr>
            ))}
            {report && (
              <tr className="bg-slate-50 font-semibold">
                <td className={td}>Total</td>
                {cells(report.total)}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Patients = unique patients in the month, not visit count. TDS basis for new visits:{' '}
        {clinic.tdsBasis === 'gross_bill' ? '10%-of-gross-bill (matches the HV sheet)' : 'on BM share'}
        ; each visit keeps the basis and rates that were active when it was billed.
      </p>
    </div>
  );
}
