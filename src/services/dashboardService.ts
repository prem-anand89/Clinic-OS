import type { UUID } from '@/domain/types';
import type { Paise } from '@/domain/money';
import type { FyMonth } from '@/domain/fiscalYear';
import { daysSince, groupOpenPackages, isStale } from '@/domain/packageTracking';
import type { Repos } from '@/repositories/types';
import { createReportService, type MonthlyReport } from './reportService';

export interface OpenPackageRow {
  packageGroupId: UUID;
  patientName: string;
  mrno: string;
  serviceName: string;
  sessionsLogged: number;
  packageTotal: number;
  startedOn: string;
  lastVisitOn: string;
  daysSinceLastVisit: number;
  stale: boolean;
}

export interface OutstandingInvoiceRow {
  invoiceId: UUID;
  invoiceNo: string;
  patientName: string;
  mrno: string;
  totalPaise: Paise;
  issuedAt: string;
  daysOutstanding: number;
}

export interface OutstandingSummary {
  rows: OutstandingInvoiceRow[];
  totalPaise: Paise;
  count: number;
}

/** Rolling window ending at (and including) the current calendar month. */
function lastNMonths(n: number, from = new Date()): FyMonth[] {
  const months: FyMonth[] = [];
  let year = from.getFullYear();
  let month = from.getMonth() + 1; // 1-12
  for (let i = 0; i < n; i++) {
    months.unshift({ year, month });
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return months;
}

export function createDashboardService(repos: Repos) {
  const reportService = createReportService(repos);

  return {
    revenueTrend(clinicId: UUID, months = 6): Promise<MonthlyReport[]> {
      return Promise.all(lastNMonths(months).map((m) => reportService.monthly(clinicId, m)));
    },

    async openPackages(clinicId: UUID, lookbackMonths = 6): Promise<OpenPackageRow[]> {
      const from = lastNMonths(lookbackMonths)[0];
      const [visits, catalog, patients] = await Promise.all([
        repos.visits.list({ clinicId, from: `${from.year}-${String(from.month).padStart(2, '0')}-01` }),
        repos.catalog.list(clinicId, true),
        repos.patients.list(clinicId),
      ]);
      const serviceName = new Map(catalog.map((c) => [c.id, c.name]));
      const patientById = new Map(patients.map((p) => [p.id, p]));

      return groupOpenPackages(visits)
        .map((g) => {
          const patient = patientById.get(g.patientId);
          return {
            packageGroupId: g.packageGroupId,
            patientName: patient?.name ?? 'Unknown',
            mrno: patient?.mrno ?? '—',
            serviceName: serviceName.get(g.serviceCatalogId) ?? 'Unknown',
            sessionsLogged: g.sessionsLogged,
            packageTotal: g.packageTotal,
            startedOn: g.startedOn,
            lastVisitOn: g.lastVisitOn,
            daysSinceLastVisit: daysSince(g.lastVisitOn),
            stale: isStale(g.lastVisitOn),
          };
        })
        .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);
    },

    async outstandingInvoices(clinicId: UUID): Promise<OutstandingSummary> {
      const [invoices, payments] = await Promise.all([
        repos.invoices.list(clinicId),
        repos.invoicePayments.list(clinicId),
      ]);
      // Absence of a payment row means paid (see InvoicePayment doc comment) —
      // only an explicit 'outstanding' row counts here.
      const statusByInvoiceId = new Map(payments.map((p) => [p.invoiceId, p.status]));
      const rows: OutstandingInvoiceRow[] = invoices
        .filter((inv) => statusByInvoiceId.get(inv.id) === 'outstanding')
        .map((inv) => ({
          invoiceId: inv.id,
          invoiceNo: inv.invoiceNo,
          patientName: inv.patientSnapshot.name,
          mrno: inv.patientSnapshot.mrno,
          totalPaise: inv.totalPaise,
          issuedAt: inv.issuedAt,
          daysOutstanding: daysSince(inv.issuedAt.slice(0, 10)),
        }))
        .sort((a, b) => b.daysOutstanding - a.daysOutstanding);

      return {
        rows,
        totalPaise: rows.reduce((sum, r) => sum + r.totalPaise, 0),
        count: rows.length,
      };
    },
  };
}
