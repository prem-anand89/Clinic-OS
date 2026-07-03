import { formatINR } from '@/domain/money';
import { th, thNum, td, tdNum } from './ui';
import type { MonthlyReport, TherapistMonthRow } from '@/services/reportService';

/** Per-therapist totals table — used on the Reports page and the monthly ledger PDF. */
export function MonthlyReportTable({ report }: { report: MonthlyReport | undefined }) {
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
  );
}
