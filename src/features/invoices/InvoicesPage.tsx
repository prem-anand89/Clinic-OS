import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { repos } from '@/services';
import { useClinic } from '@/app/clinicContext';
import { formatINR } from '@/domain/money';
import { th, thNum, td, tdNum } from '@/components/ui';

export function InvoicesPage() {
  const clinic = useClinic();
  const invoices = useLiveQuery(() => repos.invoices.list(clinic.id), [clinic.id]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Invoices</h1>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Invoice №</th>
              <th className={th}>Date</th>
              <th className={th}>Patient</th>
              <th className={th}>MRNO</th>
              <th className={thNum}>Total</th>
              <th className={th}>Mode</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(invoices ?? []).map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className={`${td} font-medium`}>{inv.invoiceNo}</td>
                <td className={td}>{inv.issuedAt.slice(0, 10)}</td>
                <td className={td}>{inv.patientSnapshot.name}</td>
                <td className={td}>{inv.patientSnapshot.mrno}</td>
                <td className={tdNum}>{formatINR(inv.totalPaise)}</td>
                <td className={td}>{inv.paymentMode}</td>
                <td className={td}>
                  <Link
                    to="/invoices/$invoiceId/print"
                    params={{ invoiceId: inv.id }}
                    className="text-blue-600 hover:underline"
                  >
                    Print
                  </Link>
                </td>
              </tr>
            ))}
            {invoices?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">
                  No invoices issued yet — issue one from the Visits table.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Issued invoices are immutable; numbering is sequential per fiscal year and gap-free.
      </p>
    </div>
  );
}
