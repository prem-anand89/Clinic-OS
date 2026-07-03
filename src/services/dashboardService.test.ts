import { beforeEach, describe, expect, it } from 'vitest';
import { createDashboardService } from './dashboardService';
import type { Repos, VisitFilter } from '@/repositories/types';
import type { CatalogItem, Clinic, Invoice, InvoicePayment, Patient, Therapist, Visit } from '@/domain/types';
import { rupeesToPaise as rs } from '@/domain/money';

function makeFakeRepos() {
  const clinic: Clinic = {
    id: 'clinic-1',
    name: 'Beyond Mechanics',
    address: null,
    phone: null,
    email: null,
    gstNo: null,
    logoPath: null,
    partnerHospitalName: 'Health Valley',
    partnerHospitalLogoPath: null,
    invoicePrefix: 'BM',
    bmSplitPct: 75,
    taxPct: 10,
    tdsBasis: 'gross_bill',
    fyStartMonth: 4,
    updatedAt: '',
  };
  const therapists: Therapist[] = [
    { id: 'th-prem', clinicId: 'clinic-1', name: 'Prem', active: true, updatedAt: '' },
  ];
  const catalog: CatalogItem[] = [
    {
      id: 'svc-1',
      clinicId: 'clinic-1',
      category: 'Manual Therapy',
      name: 'Manual Therapy',
      sessionCount: 1,
      basePricePaise: rs(1500),
      active: true,
      updatedAt: '',
    },
  ];
  const patients = new Map<string, Patient>([
    [
      'pat-1',
      {
        id: 'pat-1',
        clinicId: 'clinic-1',
        mrno: '1001',
        mrnoSource: 'hospital',
        name: 'Test Patient',
        age: 40,
        sex: 'F',
        phone: null,
        primaryCondition: null,
        updatedAt: '',
      },
    ],
  ]);
  const visits = new Map<string, Visit>();
  const invoices = new Map<string, Invoice>();
  const invoicePayments = new Map<string, InvoicePayment>();

  const repos: Repos = {
    clinics: { get: async (id) => (id === clinic.id ? clinic : undefined), list: async () => [clinic], put: async () => {} },
    therapists: { list: async () => therapists, put: async () => {} },
    catalog: { list: async () => catalog, get: async (id) => catalog.find((c) => c.id === id), put: async () => {} },
    patients: {
      get: async (id) => patients.get(id),
      getByMrno: async (_c, mrno) => [...patients.values()].find((p) => p.mrno === mrno),
      search: async () => [],
      list: async () => [...patients.values()],
      put: async (p) => void patients.set(p.id, p),
    },
    visits: {
      get: async (id) => visits.get(id),
      list: async (f: VisitFilter) =>
        [...visits.values()].filter(
          (v) => !v.deleted && v.clinicId === f.clinicId && (!f.from || v.visitDate >= f.from)
        ),
      listByIds: async (ids) => ids.map((id) => visits.get(id)!).filter(Boolean),
      listByPackageGroup: async (gid) => [...visits.values()].filter((v) => v.packageGroupId === gid && !v.deleted),
      put: async (v) => void visits.set(v.id, v),
      softDelete: async (id) => {
        const v = visits.get(id);
        if (v) visits.set(id, { ...v, deleted: true });
      },
      markInvoiced: async () => {},
    },
    invoices: {
      get: async (id) => invoices.get(id),
      list: async (clinicId) => [...invoices.values()].filter((i) => i.clinicId === clinicId),
      putLocal: async (inv) => void invoices.set(inv.id, inv),
    },
    invoicePayments: {
      getByInvoiceId: async (invoiceId) => [...invoicePayments.values()].find((p) => p.invoiceId === invoiceId),
      list: async (clinicId) => [...invoicePayments.values()].filter((p) => p.clinicId === clinicId),
      put: async (p) => void invoicePayments.set(p.id, p),
    },
    settlements: {
      getByPeriod: async () => undefined,
      list: async () => [],
      put: async () => {},
    },
  };
  return { repos, visits, invoices, invoicePayments };
}

const baseVisit = (id: string, overrides: Partial<Visit>): Visit => ({
  id,
  clinicId: 'clinic-1',
  patientId: 'pat-1',
  therapistId: 'th-prem',
  visitDate: '2026-06-01',
  condition: null,
  treatmentNotes: null,
  serviceCatalogId: 'svc-1',
  catalogPricePaise: rs(1500),
  actualBillPaise: rs(1500),
  adjustmentPaise: 0,
  adjustmentReason: null,
  sessionIndex: null,
  packageTotal: null,
  packageGroupId: null,
  bmSplitPct: 75,
  taxPct: 10,
  tdsBasis: 'gross_bill',
  bmSharePaise: rs(1125),
  postTaxPaise: rs(1013),
  tdsPaise: rs(150),
  hvPaise: rs(487),
  invoiceId: null,
  deleted: false,
  updatedAt: '',
  ...overrides,
});

const baseInvoice = (id: string, overrides: Partial<Invoice>): Invoice => ({
  id,
  clinicId: 'clinic-1',
  invoiceNo: `BM/26-27/000${id}`,
  fyLabel: '26-27',
  seq: 1,
  issuedAt: '2026-06-01T00:00:00Z',
  patientSnapshot: { mrno: '1001', name: 'Test Patient', age: 40, sex: 'F' },
  lineItems: [],
  totalPaise: rs(1500),
  paymentMode: 'Cash',
  therapistId: 'th-prem',
  updatedAt: '',
  ...overrides,
});

describe('dashboardService.revenueTrend', () => {
  it('returns 6 months in chronological order ending at the reference month', async () => {
    const fake = makeFakeRepos();
    const svc = createDashboardService(fake.repos);
    const trend = await svc.revenueTrend('clinic-1', 6);
    expect(trend).toHaveLength(6);
    for (let i = 1; i < trend.length; i++) {
      const prev = trend[i - 1].month;
      const cur = trend[i].month;
      const prevIndex = prev.year * 12 + prev.month;
      const curIndex = cur.year * 12 + cur.month;
      expect(curIndex).toBe(prevIndex + 1);
    }
  });
});

describe('dashboardService.openPackages', () => {
  let fake: ReturnType<typeof makeFakeRepos>;
  beforeEach(() => {
    fake = makeFakeRepos();
  });

  it('attaches patient/service names and computes staleness', async () => {
    fake.visits.set('v1', baseVisit('v1', { visitDate: '2026-06-01', packageGroupId: 'g1', packageTotal: 3 }));
    const svc = createDashboardService(fake.repos);
    const rows = await svc.openPackages('clinic-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      patientName: 'Test Patient',
      mrno: '1001',
      serviceName: 'Manual Therapy',
      sessionsLogged: 1,
      packageTotal: 3,
    });
  });

  it('excludes a completed package', async () => {
    fake.visits.set('v1', baseVisit('v1', { visitDate: '2026-06-01', packageGroupId: 'g1', packageTotal: 1 }));
    const svc = createDashboardService(fake.repos);
    expect(await svc.openPackages('clinic-1')).toEqual([]);
  });
});

describe('dashboardService.outstandingInvoices', () => {
  let fake: ReturnType<typeof makeFakeRepos>;
  beforeEach(() => {
    fake = makeFakeRepos();
  });

  it('treats an invoice with no payment row as paid, not outstanding', async () => {
    fake.invoices.set('inv-1', baseInvoice('inv-1', {}));
    const svc = createDashboardService(fake.repos);
    const summary = await svc.outstandingInvoices('clinic-1');
    expect(summary.rows).toEqual([]);
    expect(summary.totalPaise).toBe(0);
  });

  it('includes only invoices with an explicit outstanding payment row', async () => {
    fake.invoices.set('inv-1', baseInvoice('inv-1', { totalPaise: rs(1500) }));
    fake.invoices.set('inv-2', baseInvoice('inv-2', { totalPaise: rs(2000) }));
    fake.invoicePayments.set('p1', {
      id: 'p1',
      clinicId: 'clinic-1',
      invoiceId: 'inv-1',
      status: 'outstanding',
      paidAt: null,
      updatedAt: '',
    });
    fake.invoicePayments.set('p2', {
      id: 'p2',
      clinicId: 'clinic-1',
      invoiceId: 'inv-2',
      status: 'paid',
      paidAt: '2026-06-02T00:00:00Z',
      updatedAt: '',
    });
    const svc = createDashboardService(fake.repos);
    const summary = await svc.outstandingInvoices('clinic-1');
    expect(summary.count).toBe(1);
    expect(summary.rows[0].invoiceId).toBe('inv-1');
    expect(summary.totalPaise).toBe(rs(1500));
  });
});
