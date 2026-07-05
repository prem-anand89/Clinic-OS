import type { ReactNode } from 'react';
import { paiseToRupees, rupeesToPaise, type Paise } from '@/domain/money';

export const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100';
export const btnPrimary =
  'rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50';
export const btnSecondary =
  'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
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

/** Small caption-over-number tile for summary strips. */
export function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

const PILL_TONES = {
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  slate: 'bg-slate-100 text-slate-500',
} as const;

/** Status badge. Pair color with words/icons — never color alone. */
export function Pill({ tone, children }: { tone: keyof typeof PILL_TONES; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PILL_TONES[tone]}`}>
      {children}
    </span>
  );
}

/** Small "?" affordance explaining a jargon term inline, via native tooltip. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span
      tabIndex={0}
      title={text}
      aria-label={text}
      className="ml-1 inline-flex h-3.5 w-3.5 shrink-0 cursor-help select-none items-center justify-center rounded-full bg-slate-200 align-middle text-[10px] font-semibold leading-none text-slate-500 hover:bg-slate-300"
    >
      ?
    </span>
  );
}

export const th = 'px-3 py-2 text-left text-xs font-semibold text-slate-600';
export const td = 'px-3 py-2 text-sm text-slate-800';
export const tdNum = 'px-3 py-2 text-sm text-slate-800 text-right tabular-nums';
export const thNum = 'px-3 py-2 text-right text-xs font-semibold text-slate-600';
