import type { Paise } from './money';
import type { TdsBasis } from './split';

export type UUID = string;

export interface Clinic {
  id: UUID;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstNo: string | null;
  logoPath: string | null;
  partnerHospitalName: string | null;
  partnerHospitalLogoPath: string | null;
  invoicePrefix: string;
  bmSplitPct: number;
  taxPct: number;
  tdsBasis: TdsBasis;
  fyStartMonth: number;
  updatedAt: string;
}

export interface Therapist {
  id: UUID;
  clinicId: UUID;
  name: string;
  active: boolean;
  updatedAt: string;
}

export interface CatalogItem {
  id: UUID;
  clinicId: UUID;
  category: string;
  name: string;
  sessionCount: number;
  basePricePaise: Paise;
  active: boolean;
  updatedAt: string;
}

/** Derived on display, never stored (spec §6.2). */
export function effectivePricePerSession(item: Pick<CatalogItem, 'basePricePaise' | 'sessionCount'>): Paise {
  return Math.round(item.basePricePaise / item.sessionCount);
}

export type MrnoSource = 'hospital' | 'auto';

export interface Patient {
  id: UUID;
  clinicId: UUID;
  mrno: string;
  mrnoSource: MrnoSource;
  name: string;
  age: number | null;
  sex: 'M' | 'F' | 'Other' | null;
  phone: string | null;
  primaryCondition: string | null;
  /** Set = hidden from search/pickers; visits keep resolving. Optional: older cached rows lack the key. */
  deletedAt?: string | null;
  updatedAt: string;
}

export interface Visit {
  id: UUID;
  clinicId: UUID;
  patientId: UUID;
  therapistId: UUID;
  /** ISO date yyyy-mm-dd; day-of-week is derived, never stored */
  visitDate: string;
  condition: string | null;
  treatmentNotes: string | null;
  serviceCatalogId: UUID;
  /** Catalog price snapshot at time of billing — discounts never touch the catalog */
  catalogPricePaise: Paise;
  actualBillPaise: Paise;
  /** actual − catalog; negative = discount, positive = top-up */
  adjustmentPaise: Paise;
  adjustmentReason: string | null;
  sessionIndex: number | null;
  packageTotal: number | null;
  /** Groups the sessions of one package; therapist may change mid-package */
  packageGroupId: UUID | null;
  /**
   * Optional internal split: a share of this visit's billed amount is
   * credited to an assisting therapist in reporting only. Never changes the
   * billed amount or the primary therapist (the hospital reconciles those).
   * Optional so existing Visit rows/construction sites are unaffected.
   */
  sharedTherapistId?: UUID | null;
  sharedPct?: number | null;
  /** Rate snapshots — historical reports stay correct if clinic rates change */
  bmSplitPct: number;
  taxPct: number;
  tdsBasis: TdsBasis;
  bmSharePaise: Paise;
  postTaxPaise: Paise;
  tdsPaise: Paise;
  hvPaise: Paise;
  invoiceId: UUID | null;
  deleted: boolean;
  updatedAt: string;
}

export type PaymentMode = 'Cash' | 'Card' | 'UPI' | 'Insurance';

export interface InvoicePatientSnapshot {
  mrno: string;
  name: string;
  age: number | null;
  sex: string | null;
}

export interface InvoiceLineItem {
  serviceName: string;
  sessionCount: number;
  /** Every session date in the package, including ₹0 continuations */
  sessionDates: string[];
  catalogPricePaise: Paise;
  adjustmentPaise: Paise;
  adjustmentReason: string | null;
  totalPaise: Paise;
}

export interface Invoice {
  id: UUID;
  clinicId: UUID;
  invoiceNo: string;
  fyLabel: string;
  seq: number;
  issuedAt: string;
  patientSnapshot: InvoicePatientSnapshot;
  lineItems: InvoiceLineItem[];
  totalPaise: Paise;
  paymentMode: PaymentMode;
  therapistId: UUID | null;
  updatedAt: string;
}

export type PaymentStatus = 'paid' | 'outstanding';

/**
 * Lives apart from Invoice — invoices are immutable once issued, so payment
 * status can't be a column there. Absence of a row for an invoice means
 * "paid" (every invoice issued before this feature shipped implied
 * immediate payment; see paymentService).
 */
export interface InvoicePayment {
  id: UUID;
  clinicId: UUID;
  invoiceId: UUID;
  status: PaymentStatus;
  paidAt: string | null;
  updatedAt: string;
}

/** What Health Valley actually paid Beyond Mechanics for one fiscal month. */
export interface Settlement {
  id: UUID;
  clinicId: UUID;
  year: number;
  month: number;
  amountReceivedPaise: Paise;
  receivedDate: string | null;
  notes: string | null;
  updatedAt: string;
}
