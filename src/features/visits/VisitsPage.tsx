import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { repos, invoiceService } from '@/services';
import { useClinic } from '@/app/clinicContext';
import { formatINR } from '@/domain/money';
import type { PaymentMode, Visit } from '@/domain/types';
import { btnPrimary, btnSecondary, inputCls, th, thNum, td, tdNum, ErrorNote, Field } from '@/components/ui';

const PAYMENT_MODES: PaymentMode[] = ['Cash', 'Card', 'UPI', 'Insurance'];

export function VisitsPage() {
  const clinic = useClinic();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { patientId?: string };

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [therapistId, setTherapistId] = useState('');
  const [invoicing, setInvoicing] = useState<Visit | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
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

  async function issue() {
    if (!invoicing) return;
    setBusy(true);
    setError(null);
    try {
      const invoice = await invoiceService.issueForVisit(invoicing.id, paymentMode);
      setInvoicing(null);
      void navigate({ to: '/invoices/$invoiceId/print', params: { invoiceId: invoice.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Visits</h1>
        {filteredPatient && (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
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

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Patient</th>
              <th className={th}>Therapist</th>
              <th className={th}>Service</th>
              <th className={thNum}>Bill</th>
              <th className={thNum}>Adj.</th>
              <th className={thNum}>BM Share</th>
              <th className={thNum}>Post Tax</th>
              <th className={th}>Invoice</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(visits ?? []).map((v) => {
              const p = patientById.get(v.patientId);
              return (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className={td}>{v.visitDate}</td>
                  <td className={td}>
                    <div>{p?.name ?? '—'}</div>
                    <div className="text-xs text-slate-400">{p?.mrno}</div>
                  </td>
                  <td className={td}>{therapistName.get(v.therapistId) ?? '—'}</td>
                  <td className={td}>
                    {serviceName.get(v.serviceCatalogId) ?? '—'}
                    {v.sessionIndex && v.packageTotal && (
                      <span className="ml-1 text-xs text-slate-400">
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
                        className="text-blue-600 hover:underline"
                      >
                        View
                      </Link>
                    ) : v.actualBillPaise > 0 ? (
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() => {
                          setError(null);
                          setInvoicing(v);
                        }}
                      >
                        Invoice…
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">₹0 session</span>
                    )}
                  </td>
                  <td className={td}>
                    {!v.invoiceId && (
                      <button
                        className="text-xs text-slate-400 hover:text-red-600"
                        title="Delete visit"
                        onClick={() => {
                          if (confirm('Delete this visit?')) void repos.visits.softDelete(v.id);
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {visits?.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-sm text-slate-400">
                  No visits match — log one with “New visit”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {invoicing && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-5 shadow-lg">
            <h2 className="text-sm font-semibold text-slate-900">Issue invoice</h2>
            <p className="text-sm text-slate-600">
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
            <ErrorNote message={error} />
            <p className="text-xs text-slate-500">
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
    </div>
  );
}
