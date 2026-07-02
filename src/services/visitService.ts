import type { Visit, UUID } from '@/domain/types';
import type { Paise } from '@/domain/money';
import { computeVisitSplit } from '@/domain/split';
import type { Repos } from '@/repositories/types';

export interface NewVisitInput {
  clinicId: UUID;
  patientId: UUID;
  therapistId: UUID;
  visitDate: string;
  serviceCatalogId: UUID;
  condition?: string | null;
  treatmentNotes?: string | null;
  /** Omit to bill the catalog price; any difference requires a reason */
  actualBillPaise?: Paise;
  adjustmentReason?: string | null;
  sessionIndex?: number | null;
  packageTotal?: number | null;
  /** Set when logging session 2..N of an existing package */
  packageGroupId?: UUID | null;
  /**
   * ₹0 continuation session of a package billed on an earlier visit. The
   * catalog-price snapshot is 0 here (the package price lives on the billed
   * visit), so a zero bill is recorded as normal — not as a 100% discount.
   */
  isContinuation?: boolean;
}

export function createVisitService(repos: Repos) {
  async function buildFinancials(
    clinicId: UUID,
    serviceCatalogId: UUID,
    input: Pick<NewVisitInput, 'actualBillPaise' | 'adjustmentReason' | 'isContinuation'>
  ) {
    const clinic = await repos.clinics.get(clinicId);
    if (!clinic) throw new Error('Clinic not found');
    const item = await repos.catalog.get(serviceCatalogId);
    if (!item) throw new Error('Catalog service not found');

    const catalogPricePaise = input.isContinuation ? 0 : item.basePricePaise;
    const actualBillPaise = input.actualBillPaise ?? catalogPricePaise;
    if (actualBillPaise < 0) throw new Error('Bill amount cannot be negative');
    const adjustmentPaise = actualBillPaise - catalogPricePaise;
    if (adjustmentPaise !== 0 && !input.adjustmentReason?.trim()) {
      throw new Error('An adjustment reason is required when the bill differs from the catalog price');
    }
    return { clinic, item, catalogPricePaise, actualBillPaise, adjustmentPaise };
  }

  return {
    async create(input: NewVisitInput): Promise<Visit> {
      const { clinic, item, catalogPricePaise, actualBillPaise, adjustmentPaise } =
        await buildFinancials(input.clinicId, input.serviceCatalogId, input);

      const split = computeVisitSplit(
        actualBillPaise,
        clinic.bmSplitPct,
        clinic.taxPct,
        clinic.tdsBasis
      );

      const isPackage = (input.packageTotal ?? item.sessionCount) > 1;
      const visit: Visit = {
        id: crypto.randomUUID(),
        clinicId: input.clinicId,
        patientId: input.patientId,
        therapistId: input.therapistId,
        visitDate: input.visitDate,
        condition: input.condition?.trim() || null,
        treatmentNotes: input.treatmentNotes?.trim() || null,
        serviceCatalogId: input.serviceCatalogId,
        catalogPricePaise,
        actualBillPaise,
        adjustmentPaise,
        adjustmentReason: adjustmentPaise !== 0 ? (input.adjustmentReason?.trim() ?? null) : null,
        sessionIndex: input.sessionIndex ?? (isPackage ? 1 : null),
        packageTotal: input.packageTotal ?? (isPackage ? item.sessionCount : null),
        packageGroupId: input.packageGroupId ?? (isPackage ? crypto.randomUUID() : null),
        // Rate snapshots: historical visits keep the split that was active
        // when they were billed, even if the clinic renegotiates later.
        bmSplitPct: clinic.bmSplitPct,
        taxPct: clinic.taxPct,
        tdsBasis: clinic.tdsBasis,
        bmSharePaise: split.bmSharePaise,
        postTaxPaise: split.postTaxPaise,
        tdsPaise: split.tdsPaise,
        hvPaise: split.hvPaise,
        invoiceId: null,
        deleted: false,
        updatedAt: new Date().toISOString(),
      };
      await repos.visits.put(visit);
      return visit;
    },

    /**
     * Edits an uninvoiced visit. Splits are recomputed with the visit's
     * ORIGINAL rate snapshots — editing a bill never silently re-rates it.
     */
    async updateBilling(
      visitId: UUID,
      changes: {
        actualBillPaise?: Paise;
        adjustmentReason?: string | null;
        therapistId?: UUID;
        visitDate?: string;
        condition?: string | null;
        treatmentNotes?: string | null;
      }
    ): Promise<Visit> {
      const visit = await repos.visits.get(visitId);
      if (!visit) throw new Error('Visit not found');
      if (visit.invoiceId) {
        throw new Error('This visit is on an issued invoice; its billing is frozen.');
      }

      const actualBillPaise = changes.actualBillPaise ?? visit.actualBillPaise;
      const adjustmentPaise = actualBillPaise - visit.catalogPricePaise;
      const reason =
        changes.adjustmentReason !== undefined ? changes.adjustmentReason : visit.adjustmentReason;
      if (adjustmentPaise !== 0 && !reason?.trim()) {
        throw new Error('An adjustment reason is required when the bill differs from the catalog price');
      }
      const split = computeVisitSplit(
        actualBillPaise,
        visit.bmSplitPct,
        visit.taxPct,
        visit.tdsBasis
      );

      const updated: Visit = {
        ...visit,
        ...('therapistId' in changes && changes.therapistId ? { therapistId: changes.therapistId } : {}),
        ...('visitDate' in changes && changes.visitDate ? { visitDate: changes.visitDate } : {}),
        ...('condition' in changes ? { condition: changes.condition?.trim() || null } : {}),
        ...('treatmentNotes' in changes
          ? { treatmentNotes: changes.treatmentNotes?.trim() || null }
          : {}),
        actualBillPaise,
        adjustmentPaise,
        adjustmentReason: adjustmentPaise !== 0 ? (reason?.trim() ?? null) : null,
        ...split,
        updatedAt: new Date().toISOString(),
      };
      await repos.visits.put(updated);
      return updated;
    },
  };
}
