import { formatINR } from '@/domain/money';
import { th, thNum, td, tdNum, InfoTip } from './ui';
import type { MonthlyReport, TherapistMonthRow } from '@/services/reportService';

/**
 * Per-therapist totals table — used on the Reports page and the monthly
 * ledger PDF. The "Shared" column (internal therapist split) is shown only
 * where `showShared` is set; the hospital-facing PDF leaves it off so that
 * document stays purely about billed figures the hospital reconciles.
 */
export function MonthlyReportTable({
  report,
  showShared = false,
  own = 'BM',
  partner = 'HV',
}: {
  report: MonthlyReport | undefined;
  showShared?: boolean;
  own?: string;
  partner?: string;
}) {
  const cells = (r: TherapistMonthRow) => (
    <>
      <td className={tdNum}>{formatINR(r.billPaise)}</td>
      <td className={tdNum}>{formatINR(r.bmSharePaise)}</td>
      <td className={tdNum}>{formatINR(r.tdsPaise)}</td>
      <td className={tdNum}>{formatINR(r.postTaxPaise)}</td>
      <td className={tdNum}>{formatINR(r.hvPaise)}</td>
      {showShared && <td className={tdNum}>{r.sharedPaise !== 0 ? formatINR(r.sharedPaise) : '—'}</td>}
      {showShared && <td className={tdNum}>{formatINR(r.netPostTaxPaise)}</td>}
      <td className={tdNum}>{r.visitCount}</td>
      <td className={tdNum}>{r.uniquePatients}</td>
    </>
  );

  return (
    <table className="min-w-full divide-y divide-[var(--border)]">
      <thead className="bg-[var(--paper)]">
        <tr>
          <th className={th}>Therapist</th>
          <th className={thNum}>Bill Amount</th>
          <th className={thNum}>
            {own} Share
            {showShared && <InfoTip text={`The clinic's own cut of the bill, before tax (${own} split % from Setup).`} />}
          </th>
          <th className={thNum}>
            TDS Deducted
            {showShared && <InfoTip text="Tax Deducted at Source — withheld before payout, per the clinic's TDS basis." />}
          </th>
          <th className={thNum}>
            Post Tax {own}
            {showShared && <InfoTip text={`${own} Share after TDS — what the clinic actually keeps from this bill.`} />}
          </th>
          <th className={thNum}>
            {partner} Share
            {showShared && <InfoTip text={`The remainder of the bill after ${own}'s cut — what goes to ${partner}.`} />}
          </th>
          {showShared && (
            <th className={thNum}>
              Shared
              <InfoTip text="Money moved between therapists on split visits — negative for who gave it up, positive for who received it. Always nets to zero." />
            </th>
          )}
          {showShared && (
            <th className={thNum}>
              Net
              <InfoTip text={`Post Tax ${own}, adjusted for that therapist's splits — their real take-home figure.`} />
            </th>
          )}
          <th className={thNum}>Visits</th>
          <th className={thNum}>Patients</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--border)]">
        {(report?.rows ?? []).map((r) => (
          <tr key={r.therapistId}>
            <td className={td}>{r.therapistName}</td>
            {cells(r)}
          </tr>
        ))}
        {report && (
          <tr className="bg-[var(--paper)] font-semibold">
            <td className={td}>Total</td>
            {cells(report.total)}
          </tr>
        )}
      </tbody>
    </table>
  );
}
