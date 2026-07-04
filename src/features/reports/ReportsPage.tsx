import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { reportService, settlementService } from '@/services';
import { useClinic } from '@/app/clinicContext';
import { formatINR } from '@/domain/money';
import type { Paise } from '@/domain/money';
import { fiscalYearOf, monthsOfFiscalYear, monthName, type FyMonth } from '@/domain/fiscalYear';
import { btnPrimary, btnSecondary, inputCls, Field, RupeeInput, SectionCard, ErrorNote } from '@/components/ui';
import { MonthlyReportTable } from '@/components/MonthlyReportTable';
import { toFriendlyMessage } from '@/lib/errors';

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
          <Link
            to="/reports/print"
            search={{ year: selected.year, month: selected.month }}
            className={btnSecondary}
          >
            Export as PDF
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <MonthlyReportTable report={report} showShared />
      </div>

      <p className="text-xs text-slate-500">
        Patients = unique patients in the month, not visit count. TDS basis for new visits:{' '}
        {clinic.tdsBasis === 'gross_bill' ? '10%-of-gross-bill (matches the HV sheet)' : 'on BM share'}
        ; each visit keeps the basis and rates that were active when it was billed.
      </p>

      <SettlementCard
        clinicId={clinic.id}
        month={selected}
        expectedPaise={report?.total.postTaxPaise ?? null}
      />
    </div>
  );
}

function SettlementCard({
  clinicId,
  month,
  expectedPaise,
}: {
  clinicId: string;
  month: FyMonth;
  expectedPaise: Paise | null;
}) {
  const settlement = useLiveQuery(
    () => settlementService.get(clinicId, month.year, month.month),
    [clinicId, month.year, month.month]
  );

  const [amountPaise, setAmountPaise] = useState<Paise | null>(null);
  const [receivedDate, setReceivedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAmountPaise(settlement?.amountReceivedPaise ?? null);
    setReceivedDate(settlement?.receivedDate ?? '');
    setNotes(settlement?.notes ?? '');
    setSaved(false);
  }, [settlement, month.year, month.month]);

  async function save() {
    setError(null);
    try {
      await settlementService.save(clinicId, month.year, month.month, {
        amountReceivedPaise: amountPaise ?? 0,
        receivedDate: receivedDate || null,
        notes: notes || null,
      });
      setSaved(true);
    } catch (e) {
      setError(toFriendlyMessage(e));
    }
  }

  const variancePaise = amountPaise != null && expectedPaise != null ? amountPaise - expectedPaise : null;

  return (
    <SectionCard title={`HV settlement — ${monthName(month.month)} ${month.year}`}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label={`Expected (computed Post Tax BM)${expectedPaise == null ? '' : `: ${formatINR(expectedPaise)}`}`}>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {expectedPaise != null ? formatINR(expectedPaise) : '—'}
          </div>
        </Field>
        <Field label="Amount received from HV">
          <RupeeInput valuePaise={amountPaise} onChange={setAmountPaise} />
        </Field>
        <Field label="Received date">
          <input
            type="date"
            className={inputCls}
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
          />
        </Field>
        <Field label="Notes">
          <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      {variancePaise != null && (
        <p
          className={`mt-3 text-sm font-medium ${
            variancePaise === 0
              ? 'text-emerald-600'
              : Math.abs(variancePaise) < 100
                ? 'text-amber-600'
                : 'text-red-600'
          }`}
        >
          Variance: {variancePaise >= 0 ? '+' : ''}
          {formatINR(variancePaise)}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button className={btnPrimary} onClick={() => void save()}>
          Save settlement
        </button>
        {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
      </div>
      <ErrorNote message={error} />
    </SectionCard>
  );
}
