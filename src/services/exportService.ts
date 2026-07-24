import { db } from '@/lib/db';
import type { UUID } from '@/domain/types';

export const EXPORT_VERSION = 1;

/**
 * Full local snapshot of one clinic's data, keyed by table name — for backup
 * or for migrating into another Clinic-OS-family deployment. Reads Dexie
 * directly rather than the repos layer, so soft-deleted/inactive rows (which
 * the UI-facing repo methods filter out) are included too.
 */
export async function buildClinicExport(clinicId: UUID) {
  const clinic = await db.clinics.get(clinicId);
  if (!clinic) throw new Error('Clinic not found locally — let it sync, then try again.');

  const [therapists, service_catalog, patients, visits, invoices, invoice_payments, settlements] =
    await Promise.all([
      db.therapists.where('clinicId').equals(clinicId).toArray(),
      db.service_catalog.where('clinicId').equals(clinicId).toArray(),
      db.patients.where('clinicId').equals(clinicId).toArray(),
      db.visits.where('clinicId').equals(clinicId).toArray(),
      db.invoices.where('clinicId').equals(clinicId).toArray(),
      db.invoice_payments.where('clinicId').equals(clinicId).toArray(),
      db.settlements.where('clinicId').equals(clinicId).toArray(),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    exportVersion: EXPORT_VERSION,
    clinic,
    therapists,
    service_catalog,
    patients,
    visits,
    invoices,
    invoice_payments,
    settlements,
  };
}
