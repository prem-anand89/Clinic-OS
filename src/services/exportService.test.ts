import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { buildClinicExport } from './exportService';
import type { Clinic, Patient, Therapist, Visit } from '@/domain/types';
import { rupeesToPaise as rs } from '@/domain/money';

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
  updatedAt: '2026-01-01T00:00:00Z',
};

const therapist: Therapist = {
  id: 'th-1',
  clinicId: 'clinic-1',
  name: 'Prem',
  active: true,
  updatedAt: '2026-01-01T00:00:00Z',
};

const patient: Patient = {
  id: 'pat-1',
  clinicId: 'clinic-1',
  mrno: 'BM0001',
  mrnoSource: 'auto',
  name: 'Asha Rao',
  age: 30,
  sex: 'F',
  phone: '9999999999',
  primaryCondition: 'Knee pain',
  updatedAt: '2026-01-01T00:00:00Z',
};

const visit: Visit = {
  id: 'vis-1',
  clinicId: 'clinic-1',
  patientId: 'pat-1',
  therapistId: 'th-1',
  visitDate: '2026-01-05',
  condition: 'Knee pain',
  treatmentNotes: null,
  serviceCatalogId: 'svc-1',
  catalogPricePaise: rs(800),
  actualBillPaise: rs(800),
  adjustmentPaise: 0,
  adjustmentReason: null,
  sessionIndex: null,
  packageTotal: null,
  packageGroupId: null,
  bmSplitPct: 75,
  taxPct: 10,
  tdsBasis: 'gross_bill',
  bmSharePaise: rs(600),
  postTaxPaise: rs(540),
  tdsPaise: rs(60),
  hvPaise: rs(200),
  invoiceId: null,
  deleted: false,
  updatedAt: '2026-01-05T00:00:00Z',
};

describe('buildClinicExport', () => {
  beforeEach(async () => {
    await db.clinics.put(clinic);
    await db.therapists.put(therapist);
    await db.patients.put(patient);
    await db.visits.put(visit);
    // A second clinic's data must never leak into the export.
    await db.clinics.put({ ...clinic, id: 'clinic-2', name: 'Other Clinic' });
    await db.patients.put({ ...patient, id: 'pat-2', clinicId: 'clinic-2' });
  });

  afterEach(async () => {
    await db.clinics.clear();
    await db.therapists.clear();
    await db.patients.clear();
    await db.visits.clear();
  });

  it('bundles every clinic-scoped table for the requested clinic only', async () => {
    const result = await buildClinicExport('clinic-1');

    expect(result.exportVersion).toBe(1);
    expect(result.clinic).toEqual(clinic);
    expect(result.therapists).toEqual([therapist]);
    expect(result.patients).toEqual([patient]);
    expect(result.visits).toEqual([visit]);
    expect(result.service_catalog).toEqual([]);
    expect(result.invoices).toEqual([]);
    expect(result.invoice_payments).toEqual([]);
    expect(result.settlements).toEqual([]);
  });

  it('includes soft-deleted visits, unlike the repo-level list()', async () => {
    await db.visits.put({ ...visit, id: 'vis-2', deleted: true });

    const result = await buildClinicExport('clinic-1');

    expect(result.visits.map((v) => v.id).sort()).toEqual(['vis-1', 'vis-2']);
  });

  it('throws when the clinic is not present locally', async () => {
    await expect(buildClinicExport('does-not-exist')).rejects.toThrow('Clinic not found');
  });
});
