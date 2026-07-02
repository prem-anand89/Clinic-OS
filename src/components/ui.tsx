import type { ReactNode } from 'react';
import { paiseToRupees, rupeesToPaise, type Paise } from '@/domain/money';

export const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100';
export const btnPrimary =
  'rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50';
export const btnSecondary =
  'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}

/** Text input holding rupees, reporting paise. Blank ⇒ null. */
export function RupeeInput({
  valuePaise,
  onChange,
  disabled,
}: {
  valuePaise: Paise | null;
  onChange: (paise: Paise | null) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      min={0}
      step="1"
      inputMode="decimal"
      className={inputCls}
      disabled={disabled}
      value={valuePaise == null ? '' : paiseToRupees(valuePaise)}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === '' ? null : rupeesToPaise(Number(raw)));
      }}
    />
  );
}

export const th = 'px-3 py-2 text-left text-xs font-semibold text-slate-600';
export const td = 'px-3 py-2 text-sm text-slate-800';
export const tdNum = 'px-3 py-2 text-sm text-slate-800 text-right tabular-nums';
export const thNum = 'px-3 py-2 text-right text-xs font-semibold text-slate-600';
