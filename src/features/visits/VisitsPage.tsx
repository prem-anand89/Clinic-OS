import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { repos, invoiceService, paymentService, visitService } from '@/services';
import { useClinic } from '@/app/clinicContext';
import { formatINR } from '@/domain/money';
import { clinicShareLabels, type PaymentMode, type Therapist, type Visit } from '@/domain/types';
import { btnPrimary, btnSecondary, inputCls, th, thNum, td, tdNum, ErrorNote, Field, StatTile } from '@/components/ui';
import { applySort, byNumber, byString, SortHeader, useSort } from '@/components/sortable';
import { toFriendlyMessage } from '@/lib/errors';

const PAYMENT_MODES: PaymentMode[] = ['Cash', 'Card', 'UPI', 'Insurance'];

export function VisitsPage() {
  const clinic = useClinic();
  const labels = clinicShareLabels(clinic);
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { patientId?: string };

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [therapistId, setTherapistId] = useState('');
  const [invoicing, setInvoicing] = useState<Visit | null>(null);
  const [splitting, setSplitting] = useState<Visit | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [paidNow, setPaidNow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const therapists = useLiveQuery(() => repos.therapists.list(clinic.id, true), [clinic.id]);
  const patients = useLiveQuery(() => repos.patients.list(clinic.id), [clinic.id]);
  const visits = useLiveQuery(
    () =>
      repos.visits.list({
        clinicId: clinic.id,
        from: from || undefined,
        to: to || undefined,
        therapistId: therapistId || undefined,
        patientId: search.patientId,
      }),
    [clinic.id, from, to, therapistId, search.patientId]
  );

  const therapistName = useMemo(
    () => new Map((therapists ?? []).map((t) => [t.id, t.name])),
    [therapists]
  );
  const patientById = useMemo(() => new Map((patients ?? []).map((p) => [p.id, p])), [patients]);
  const catalog = useLiveQuery(() => repos.catalog.list(clinic.id, true), [clinic.id]);
  const serviceName = useMemo(() => new Map((catalog ?? []).map((c) => [c.id, c.name])), [catalog]);

  const filteredPatient = search.patientId ? patientById.get(search.patientId) : undefined;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayVisits = useMemo(() => (visits ?? []).filter((v) => v.visitDate === todayStr), [visits, todayStr]);
  const todayBillPaise = useMemo(
    () => todayVisits.reduce((sum, v) => sum + v.actualBillPaise, 0),
    [todayVisits]
  );
  const pendingInvoiceCount = useMemo(
    () => (visits ?? []).filter((v) => !v.invoiceId && v.actualBillPaise > 0).length,
    [visits]
  );

  const sort = useSort<'date' | 'patient' | 'therapist' | 'bill' | 'bmShare' | 'postTax'>('date', 'desc');
  const sortedVisits = applySort(
    visits ?? [],
    {
      date: byString<Visit>((v) => v.visitDate),
      patient: byString<Visit>((v) => patientById.get(v.patientId)?.name ?? ''),
      therapist: byString<Visit>((v) => therapistName.get(v.therapistId) ?? ''),
      bill: byNumber<Visit>((v) => v.actualBillPaise),
      bmShare: byNumber<Visit>((v) => v.bmSharePaise),
      postTax: byNumber<Visit>((v) => v.postTaxPaise),
    },
    sort
  );

  async function issue() {
    if (!invoicing) return;
    setBusy(true);
    setError(null);
    try {
      const invoice = await invoiceService.issueForVisit(invoicing.id, paymentMode);
      try {
        await paymentService.setStatus(invoice.id, clinic.id, paidNow ? 'paid' : 'outstanding');
      } catch (statusError) {
        // Non-fatal: the invoice IS issued (retrying would fail with
        // "already invoiced"), and a missing status row reads as Paid —
        // correctable anytime from the Invoices page.
        console.error('Could not record payment status', statusError);
      }
      setInvoicing(null);
      void navigate({ to: '/invoices/$invoiceId/print', params: { invoiceId: invoice.id } });
    } catch (e) {
      setError(toFriendlyMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="font-display text-lg font-semibold text-[var(--ink)]">Visits</h1>
        {filteredPatient && (
          <span className="rounded-full bg-[var(--teal-light)] px-3 py-1 text-xs text-[var(--teal)]">
            {filteredPatient.name} ({filteredPatient.mrno})
            <Link to="/visits" className="ml-2 font-medium">
              ✕
            </Link>
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <Field label="From">
            <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Therapist">
            <select className={inputCls} value={therapistId} onChange={(e) => setTherapistId(e.target.value)}>
              <option value="">All</option>
              {(therapists ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Link to="/visits/new" className={btnPrimary}>
            + New visit
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <StatTile label="Today's visits" value={todayVisits.length} />
        <StatTile label="Today's billed" value={formatINR(todayBillPaise)} />
        <StatTile label="Pending invoices" value={pendingInvoiceCount} />
      </div>

      <div className="overflow-x-auto rounded-[10px] border border-[var(--border)] bg-[var(--surface)]">
        <table className="min-w-full divide-y divide-[var(--border)]">
          <thead className="bg-[var(--paper)]">
            <tr>
              <SortHeader label="Date" k="date" sort={sort} firstDir="desc" />
              <SortHeader label="Patient" k="patient" sort={sort} />
              <SortHeader label="Therapist" k="therapist" sort={sort} />
              <th className={th}>Service</th>
              <SortHeader label="Bill" k="bill" sort={sort} numeric firstDir="desc" />
              <th className={thNum}>Adj.</th>
              <SortHeader label={`${labels.own} Share`} k="bmShare" sort={sort} numeric firstDir="desc" />
              <SortHeader label="Post Tax" k="postTax" sort={sort} numeric firstDir="desc" />
              <th className={th}>Invoice</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {sortedVisits.map((v) => {
              const p = patientById.get(v.patientId);
              return (
                <tr key={v.id} className="hover:bg-[var(--paper)]">
                  <td className={td}>{v.visitDate}</td>
                  <td className={td}>
                    <div className="font-display">{p?.name ?? '—'}</div>
                    <div className="text-xs text-[var(--muted)]">{p?.mrno}</div>
                  </td>
                  <td className={td}>
                    {therapistName.get(v.therapistId) ?? '—'}
                    {v.sharedTherapistId && (
                      <div className="text-xs font-medium text-[var(--moss-strong)]" title="Internal revenue split">
                        ⇄ {therapistName.get(v.sharedTherapistId) ?? '—'} {v.sharedPct}%
                      </div>
                    )}
                  </td>
                  <td className={td}>
                    {serviceName.get(v.serviceCatalogId) ?? '—'}
                    {v.sessionIndex && v.packageTotal && (
                      <span className="ml-1 text-xs text-[var(--muted)]">
                        {v.sessionIndex}/{v.packageTotal}
                      </span>
                    )}
                  </td>
                  <td className={tdNum}>{formatINR(v.actualBillPaise)}</td>
                  <td className={tdNum} title={v.adjustmentReason ?? undefined}>
                    {v.adjustmentPaise !== 0 ? formatINR(v.adjustmentPaise) : '—'}
                  </td>
                  <td className={tdNum}>{formatINR(v.bmSharePaise)}</td>
                  <td className={tdNum}>{formatINR(v.postTaxPaise)}</td>
                  <td className={td}>
                    {v.invoiceId ? (
                      <Link
                        to="/invoices/$invoiceId/print"
                        params={{ invoiceId: v.invoiceId }}
                        className="font-medium text-[var(--teal)] hover:underline"
                      >
                        View
                      </Link>
                    ) : v.actualBillPaise > 0 ? (
                      <button
                        className="font-medium text-[var(--teal)] hover:underline"
                        onClick={() => {
                          setError(null);
                          setPaidNow(true);
                          setInvoicing(v);
                        }}
                      >
                        Invoice…
                      </button>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">₹0 session</span>
                    )}
                  </td>
                  <td className={td}>
                    <div className="flex gap-3">
                      {v.actualBillPaise > 0 && (
                        <button
                          className="text-xs text-[var(--muted)] hover:text-[var(--moss)]"
                          title="Share this visit's revenue with another therapist"
                          onClick={() => {
                            setError(null);
                            setSplitting(v);
                          }}
                        >
                          {v.sharedTherapistId ? 'Edit split' : 'Split'}
                        </button>
                      )}
                      {!v.invoiceId && (
                        <button
                          className="text-xs text-[var(--muted)] hover:text-[var(--rust)]"
                          title="Delete visit"
                          onClick={() => {
                            if (confirm('Delete this visit?')) void repos.visits.softDelete(v.id);
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {visits?.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-sm text-[var(--muted)]">
                  No visits match — log one with “New visit”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {invoicing && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[var(--ink)]/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-[10px] bg-[var(--surface)] p-5">
            <h2 className="text-sm font-semibold text-[var(--ink)]">Issue invoice</h2>
            <p className="text-sm text-[var(--muted)]">
              {patientById.get(invoicing.patientId)?.name} —{' '}
              {serviceName.get(invoicing.serviceCatalogId)}
              {invoicing.packageGroupId && ', all sessions of this package'}
            </p>
            <Field label="Payment mode">
              <select
                className={inputCls}
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={paidNow} onChange={() => setPaidNow(true)} />
                Paid now
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={!paidNow} onChange={() => setPaidNow(false)} />
                Outstanding — pay later
              </label>
            </div>
            <ErrorNote message={error} />
            <p className="text-xs text-[var(--muted)]">
              The invoice number is issued by the server and the bill becomes immutable — this
              needs a connection and cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button className={btnSecondary} onClick={() => setInvoicing(null)}>
                Cancel
              </button>
              <button className={btnPrimary} disabled={busy} onClick={() => void issue()}>
                {busy ? 'Issuing…' : 'Issue invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {splitting && (
        <SplitModal
          visit={splitting}
          therapists={(therapists ?? []).filter((t) => t.id !== splitting.therapistId)}
          primaryName={therapistName.get(splitting.therapistId) ?? '—'}
          onClose={() => setSplitting(null)}
        />
      )}
    </div>
  );
}

function SplitModal({
  visit,
  therapists,
  primaryName,
  onClose,
}: {
  visit: Visit;
  therapists: Therapist[];
  primaryName: string;
  onClose: () => void;
}) {
  const [sharedTherapistId, setSharedTherapistId] = useState(visit.sharedTherapistId ?? '');
  const [pct, setPct] = useState(visit.sharedPct != null ? String(visit.sharedPct) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pctNum = Number(pct);
  const preview =
    pctNum > 0 && pctNum <= 100 ? Math.round((visit.actualBillPaise * pctNum) / 100) : null;

  async function save(clear: boolean) {
    setError(null);
    setBusy(true);
    try {
      await visitService.setSplit(visit.id, {
        sharedTherapistId: clear ? null : sharedTherapistId || null,
        sharedPct: clear ? null : pctNum,
      });
      onClose();
    } catch (e) {
      setError(toFriendlyMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[var(--ink)]/40 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-[10px] bg-[var(--surface)] p-5">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Share visit revenue</h2>
        <p className="text-sm text-[var(--muted)]">
          Credit part of this {formatINR(visit.actualBillPaise)} visit (billed under {primaryName}) to
          an assisting therapist. This is internal only — the billed amount, date, and therapist the
          hospital sees don’t change.
        </p>
        <Field label="Assisting therapist">
          <select
            className={inputCls}
            value={sharedTherapistId}
            onChange={(e) => setSharedTherapistId(e.target.value)}
          >
            <option value="">Select…</option>
            {therapists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Their share (%)">
          <input
            type="number"
            min={1}
            max={100}
            className={inputCls}
            value={pct}
            onChange={(e) => setPct(e.target.value)}
          />
        </Field>
        {preview != null && sharedTherapistId && (
          <p className="text-xs text-[var(--muted)]">
            {formatINR(preview)} moves to {therapists.find((t) => t.id === sharedTherapistId)?.name} in
            the Shared column; {formatINR(visit.actualBillPaise - preview)} stays with {primaryName}.
          </p>
        )}
        <ErrorNote message={error} />
        <div className="flex justify-between gap-2">
          <div>
            {visit.sharedTherapistId && (
              <button className={btnSecondary} disabled={busy} onClick={() => void save(true)}>
                Remove split
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button className={btnSecondary} onClick={onClose}>
              Cancel
            </button>
            <button
              className={btnPrimary}
              disabled={busy || !sharedTherapistId || !(pctNum > 0)}
              onClick={() => void save(false)}
            >
              {busy ? 'Saving…' : 'Save split'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
