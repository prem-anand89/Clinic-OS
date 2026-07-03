import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { dashboardService } from '@/services';
import { useClinic } from '@/app/clinicContext';
import { formatINR } from '@/domain/money';
import { monthName } from '@/domain/fiscalYear';
import { SectionCard, th, thNum, td, tdNum } from '@/components/ui';
import { BarChart } from '@/components/BarChart';

// Reference categorical palette — all 8 validated slots in fixed order,
// assigned by index and never cycled (a 9th series would repeat hues and
// break CVD separation; fold into "Other" before that ever happens).
const SERIES_COLORS = [
  '#2a78d6', // blue
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
  '#e87ba4', // magenta
  '#eb6834', // orange
];
const STATUS_WARNING = '#fab219';

export function DashboardPage() {
  const clinic = useClinic();

  const trend = useLiveQuery(() => dashboardService.revenueTrend(clinic.id), [clinic.id]);
  const openPackages = useLiveQuery(() => dashboardService.openPackages(clinic.id), [clinic.id]);
  const outstanding = useLiveQuery(() => dashboardService.outstandingInvoices(clinic.id), [clinic.id]);

  const categories = useMemo(
    () => (trend ?? []).map((r) => `${monthName(r.month.month).slice(0, 3)} '${String(r.month.year).slice(2)}`),
    [trend]
  );

  const therapistNames = useMemo(
    () => [...new Set((trend ?? []).flatMap((r) => r.rows.map((row) => row.therapistName)))].sort(),
    [trend]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>

      <SectionCard title="Revenue trend — last 6 months (Post-Tax BM)">
        {trend && (
          <BarChart
            categories={categories}
            series={[
              {
                label: 'Post-Tax BM',
                color: SERIES_COLORS[0],
                values: trend.map((r) => r.total.postTaxPaise),
              },
            ]}
            formatValue={formatINR}
          />
        )}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr>
                <th className={th}>Month</th>
                <th className={thNum}>Bill</th>
                <th className={thNum}>BM Share</th>
                <th className={thNum}>TDS</th>
                <th className={thNum}>Post Tax</th>
                <th className={thNum}>HV</th>
                <th className={thNum}>Visits</th>
                <th className={thNum}>Patients</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(trend ?? []).map((r, i) => (
                <tr key={i}>
                  <td className={td}>{categories[i]}</td>
                  <td className={tdNum}>{formatINR(r.total.billPaise)}</td>
                  <td className={tdNum}>{formatINR(r.total.bmSharePaise)}</td>
                  <td className={tdNum}>{formatINR(r.total.tdsPaise)}</td>
                  <td className={tdNum}>{formatINR(r.total.postTaxPaise)}</td>
                  <td className={tdNum}>{formatINR(r.total.hvPaise)}</td>
                  <td className={tdNum}>{r.total.visitCount}</td>
                  <td className={tdNum}>{r.total.uniquePatients}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Therapist comparison — Post-Tax BM">
        {trend && therapistNames.length > 0 && (
          <BarChart
            categories={categories}
            series={therapistNames.slice(0, SERIES_COLORS.length).map((name, i) => ({
              label: name,
              color: SERIES_COLORS[i],
              values: trend.map((r) => r.rows.find((row) => row.therapistName === name)?.postTaxPaise ?? 0),
            }))}
            formatValue={formatINR}
          />
        )}
        {trend && therapistNames.length === 0 && (
          <p className="text-sm text-slate-400">No visits in the last 6 months.</p>
        )}
      </SectionCard>

      <SectionCard title="Open packages">
        <p className="mb-3 text-xs text-slate-500">
          Packages still short of their session count, most-quiet first. A patient not seen in over
          14 days is flagged stale.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr>
                <th className={th}>Patient</th>
                <th className={th}>Service</th>
                <th className={thNum}>Progress</th>
                <th className={th}>Started</th>
                <th className={th}>Last visit</th>
                <th className={thNum}>Days since</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(openPackages ?? []).map((p) => (
                <tr key={p.packageGroupId}>
                  <td className={td}>
                    {p.patientName} <span className="text-xs text-slate-400">{p.mrno}</span>
                  </td>
                  <td className={td}>{p.serviceName}</td>
                  <td className={tdNum}>
                    {p.sessionsLogged} of {p.packageTotal}
                  </td>
                  <td className={td}>{p.startedOn}</td>
                  <td className={td}>{p.lastVisitOn}</td>
                  <td className={tdNum}>{p.daysSinceLastVisit}</td>
                  <td className={td}>
                    {p.stale && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: STATUS_WARNING }}
                      >
                        ⚠ Stale
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {openPackages?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-400">
                    No open packages in the last 6 months.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Outstanding payments">
        <div className="mb-4 flex gap-6">
          <div className="rounded-md bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500">Total outstanding</div>
            <div className="text-lg font-semibold text-slate-900">
              {formatINR(outstanding?.totalPaise ?? 0)}
            </div>
          </div>
          <div className="rounded-md bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500">Invoices</div>
            <div className="text-lg font-semibold text-slate-900">{outstanding?.count ?? 0}</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr>
                <th className={th}>Invoice №</th>
                <th className={th}>Patient</th>
                <th className={thNum}>Amount</th>
                <th className={th}>Issued</th>
                <th className={thNum}>Days outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(outstanding?.rows ?? []).map((r) => (
                <tr key={r.invoiceId}>
                  <td className={td}>
                    <Link
                      to="/invoices/$invoiceId/print"
                      params={{ invoiceId: r.invoiceId }}
                      className="text-blue-600 hover:underline"
                    >
                      {r.invoiceNo}
                    </Link>
                  </td>
                  <td className={td}>
                    {r.patientName} <span className="text-xs text-slate-400">{r.mrno}</span>
                  </td>
                  <td className={tdNum}>{formatINR(r.totalPaise)}</td>
                  <td className={td}>{r.issuedAt.slice(0, 10)}</td>
                  <td className={tdNum}>{r.daysOutstanding}</td>
                </tr>
              ))}
              {outstanding?.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-400">
                    Nothing outstanding.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
