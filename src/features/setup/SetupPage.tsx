import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { repos } from '@/services';
import { useClinic } from '@/app/clinicContext';
import { getSupabase } from '@/lib/supabase';
import { formatINR } from '@/domain/money';
import { effectivePricePerSession, type CatalogItem, type Clinic } from '@/domain/types';
import type { TdsBasis } from '@/domain/split';
import {
  Field,
  inputCls,
  btnPrimary,
  btnSecondary,
  ErrorNote,
  RupeeInput,
  SectionCard,
  th,
  thNum,
  td,
  tdNum,
} from '@/components/ui';

export function SetupPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Setup</h1>
      <ClinicProfile />
      <Catalog />
      <Therapists />
      <SectionCard title="Historical data">
        <p className="mb-3 text-xs text-slate-500">
          One-time import of visits logged before go-live in the Excel ledger.
        </p>
        <Link to="/setup/import-visits" className="text-sm text-blue-600 hover:underline">
          Import historical visits from Excel →
        </Link>
      </SectionCard>
    </div>
  );
}

function ClinicProfile() {
  const clinic = useClinic();
  const [form, setForm] = useState<Clinic>(clinic);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setForm(clinic), [clinic]);

  const set = (patch: Partial<Clinic>) => {
    setSaved(false);
    setForm((f) => ({ ...f, ...patch }));
  };

  async function uploadLogo(file: File, field: 'logoPath' | 'partnerHospitalLogoPath') {
    setError(null);
    const supabase = getSupabase();
    if (!supabase || !navigator.onLine) {
      setError('Logo upload needs a connection.');
      return;
    }
    const path = `${clinic.id}/${field === 'logoPath' ? 'logo' : 'partner-logo'}-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('clinic-assets').upload(path, file);
    if (error) {
      setError(`Upload failed: ${error.message}`);
      return;
    }
    const updated = { ...form, [field]: path, updatedAt: new Date().toISOString() };
    setForm(updated);
    await repos.clinics.put(updated);
  }

  async function save() {
    setError(null);
    await repos.clinics.put({ ...form, updatedAt: new Date().toISOString() });
    setSaved(true);
  }

  return (
    <SectionCard title="Clinic profile & letterhead">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Field label="Clinic name">
          <input className={inputCls} value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Invoice prefix">
          <input
            className={inputCls}
            value={form.invoicePrefix}
            onChange={(e) => set({ invoicePrefix: e.target.value.toUpperCase() })}
          />
        </Field>
        <Field label="GST / Tax ID (optional)">
          <input className={inputCls} value={form.gstNo ?? ''} onChange={(e) => set({ gstNo: e.target.value || null })} />
        </Field>
        <Field label="Address">
          <input className={inputCls} value={form.address ?? ''} onChange={(e) => set({ address: e.target.value || null })} />
        </Field>
        <Field label="Phone">
          <input className={inputCls} value={form.phone ?? ''} onChange={(e) => set({ phone: e.target.value || null })} />
        </Field>
        <Field label="Email">
          <input className={inputCls} value={form.email ?? ''} onChange={(e) => set({ email: e.target.value || null })} />
        </Field>
        <Field label="Partner hospital (optional, prints on invoices if set)">
          <input
            className={inputCls}
            value={form.partnerHospitalName ?? ''}
            onChange={(e) => set({ partnerHospitalName: e.target.value || null })}
          />
        </Field>
        <Field label="Clinic share % (BM split)">
          <input
            type="number"
            className={inputCls}
            value={form.bmSplitPct}
            onChange={(e) => set({ bmSplitPct: Number(e.target.value) })}
          />
        </Field>
        <Field label="Tax / TDS %">
          <input
            type="number"
            className={inputCls}
            value={form.taxPct}
            onChange={(e) => set({ taxPct: Number(e.target.value) })}
          />
        </Field>
        <Field label="TDS basis">
          <select
            className={inputCls}
            value={form.tdsBasis}
            onChange={(e) => set({ tdsBasis: e.target.value as TdsBasis })}
          >
            <option value="gross_bill">10% of gross bill (matches HV sheet)</option>
            <option value="bm_share">On clinic share only</option>
          </select>
        </Field>
        <Field label="Fiscal year starts in month">
          <input
            type="number"
            min={1}
            max={12}
            className={inputCls}
            value={form.fyStartMonth}
            onChange={(e) => set({ fyStartMonth: Number(e.target.value) })}
          />
        </Field>
        <Field label="Clinic logo">
          <input
            type="file"
            accept="image/*"
            className={inputCls}
            onChange={(e) => e.target.files?.[0] && void uploadLogo(e.target.files[0], 'logoPath')}
          />
        </Field>
        <Field label="Partner hospital logo">
          <input
            type="file"
            accept="image/*"
            className={inputCls}
            onChange={(e) =>
              e.target.files?.[0] && void uploadLogo(e.target.files[0], 'partnerHospitalLogoPath')
            }
          />
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className={btnPrimary} onClick={() => void save()}>
          Save clinic settings
        </button>
        {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Split/tax changes apply to NEW visits only — past visits keep the rates they were billed
        under.
      </p>
      <div className="mt-2">
        <ErrorNote message={error} />
      </div>
    </SectionCard>
  );
}

function Catalog() {
  const clinic = useClinic();
  const items = useLiveQuery(() => repos.catalog.list(clinic.id, true), [clinic.id]);
  const [draft, setDraft] = useState({ category: '', name: '', sessionCount: '1' });
  const [draftPrice, setDraftPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addItem() {
    setError(null);
    if (!draft.category.trim() || !draft.name.trim() || draftPrice == null) {
      setError('Category, name, and price are required');
      return;
    }
    const item: CatalogItem = {
      id: crypto.randomUUID(),
      clinicId: clinic.id,
      category: draft.category.trim(),
      name: draft.name.trim(),
      sessionCount: Math.max(1, Number(draft.sessionCount) || 1),
      basePricePaise: draftPrice,
      active: true,
      updatedAt: new Date().toISOString(),
    };
    await repos.catalog.put(item);
    setDraft({ category: draft.category, name: '', sessionCount: '1' });
    setDraftPrice(null);
  }

  async function toggleActive(item: CatalogItem) {
    await repos.catalog.put({ ...item, active: !item.active, updatedAt: new Date().toISOString() });
  }

  async function updatePrice(item: CatalogItem, pricePaise: number | null) {
    if (pricePaise == null) return;
    await repos.catalog.put({
      ...item,
      basePricePaise: pricePaise,
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <SectionCard title="Service catalog">
      <p className="mb-3 text-xs text-slate-500">
        Price changes affect FUTURE visits only — logged visits keep their price snapshot.
        Deactivate instead of deleting so history keeps resolving; per-session price is always
        derived (price ÷ sessions), never stored.
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Category</th>
              <th className={th}>Package</th>
              <th className={thNum}>Sessions</th>
              <th className={thNum}>Price</th>
              <th className={thNum}>Per session</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(items ?? []).map((item) => (
              <tr key={item.id} className={item.active ? '' : 'opacity-50'}>
                <td className={td}>{item.category}</td>
                <td className={td}>{item.name}</td>
                <td className={tdNum}>{item.sessionCount}</td>
                <td className={`${tdNum} w-32`}>
                  <RupeeInput
                    valuePaise={item.basePricePaise}
                    onChange={(p) => void updatePrice(item, p)}
                  />
                </td>
                <td className={tdNum}>{formatINR(effectivePricePerSession(item))}</td>
                <td className={td}>
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => void toggleActive(item)}
                  >
                    {item.active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50/50">
              <td className={td}>
                <input
                  className={inputCls}
                  placeholder="Category"
                  list="catalog-categories"
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                />
                <datalist id="catalog-categories">
                  {[...new Set((items ?? []).map((i) => i.category))].map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </td>
              <td className={td}>
                <input
                  className={inputCls}
                  placeholder="Package name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </td>
              <td className={`${td} w-24`}>
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={draft.sessionCount}
                  onChange={(e) => setDraft({ ...draft, sessionCount: e.target.value })}
                />
              </td>
              <td className={`${td} w-32`}>
                <RupeeInput valuePaise={draftPrice} onChange={setDraftPrice} />
              </td>
              <td className={td} colSpan={2}>
                <button className={btnSecondary} onClick={() => void addItem()}>
                  + Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-2">
        <ErrorNote message={error} />
      </div>
    </SectionCard>
  );
}

function Therapists() {
  const clinic = useClinic();
  const therapists = useLiveQuery(() => repos.therapists.list(clinic.id, true), [clinic.id]);
  const [name, setName] = useState('');

  async function add() {
    if (!name.trim()) return;
    await repos.therapists.put({
      id: crypto.randomUUID(),
      clinicId: clinic.id,
      name: name.trim(),
      active: true,
      updatedAt: new Date().toISOString(),
    });
    setName('');
  }

  return (
    <SectionCard title="Therapists">
      <ul className="mb-3 space-y-1">
        {(therapists ?? []).map((t) => (
          <li key={t.id} className="flex items-center gap-3 text-sm">
            <span className={t.active ? '' : 'text-slate-400 line-through'}>{t.name}</span>
            <button
              className="text-xs text-blue-600 hover:underline"
              onClick={() =>
                void repos.therapists.put({
                  ...t,
                  active: !t.active,
                  updatedAt: new Date().toISOString(),
                })
              }
            >
              {t.active ? 'Deactivate' : 'Reactivate'}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex max-w-sm gap-2">
        <input
          className={inputCls}
          placeholder="New therapist name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className={btnSecondary} onClick={() => void add()}>
          + Add
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Deactivating keeps history intact — past visits still show the therapist.
      </p>
    </SectionCard>
  );
}
