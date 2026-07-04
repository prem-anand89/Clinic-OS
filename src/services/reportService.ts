import type { UUID } from '@/domain/types';
import type { Paise } from '@/domain/money';
import { paiseToRupees } from '@/domain/money';
import { monthDateRange, monthName, type FyMonth } from '@/domain/fiscalYear';
import type { Repos } from '@/repositories/types';

export interface TherapistMonthRow {
  therapistId: UUID | 'total';
  therapistName: string;
  billPaise: Paise;
  bmSharePaise: Paise;
  tdsPaise: Paise;
  postTaxPaise: Paise;
  hvPaise: Paise;
  /** Net catalog-vs-actual variance — "revenue lost to discounts" when negative */
  adjustmentPaise: Paise;
  /**
   * Internal therapist split: net billed-rupees credited to (+) or given up
   * by (−) this therapist via same-visit splits. Nets to zero on the Total
   * row — purely an internal redistribution, never touches billed totals.
   */
  sharedPaise: Paise;
  visitCount: number;
  /** COUNT(DISTINCT mrno) — unique patients, not visit count (spec §5.2) */
  uniquePatients: number;
}

export interface MonthlyReport {
  month: FyMonth;
  title: string;
  rows: TherapistMonthRow[];
  total: TherapistMonthRow;
}

/**
 * Monthly rollup, computed from stored visit records — never entered by hand
 * (spec §5.2). Because splits were rounded once per visit at billing time,
 * these sums always reconcile with each other.
 */
export function createReportService(repos: Repos) {
  return {
    async monthly(clinicId: UUID, month: FyMonth): Promise<MonthlyReport> {
      const { from, to } = monthDateRange(month);
      const [visits, therapists] = await Promise.all([
        repos.visits.list({ clinicId, from, to }),
        repos.therapists.list(clinicId, true),
      ]);
      const therapistName = new Map(therapists.map((t) => [t.id, t.name]));

      const rowsById = new Map<string, TherapistMonthRow>();
      const patientsByTherapist = new Map<string, Set<string>>();
      const allPatients = new Set<string>();

      const blank = (id: UUID | 'total', name: string): TherapistMonthRow => ({
        therapistId: id,
        therapistName: name,
        billPaise: 0,
        bmSharePaise: 0,
        tdsPaise: 0,
        postTaxPaise: 0,
        hvPaise: 0,
        adjustmentPaise: 0,
        sharedPaise: 0,
        visitCount: 0,
        uniquePatients: 0,
      });

      const rowFor = (id: UUID): TherapistMonthRow =>
        rowsById.get(id) ??
        rowsById.set(id, blank(id, therapistName.get(id) ?? 'Unknown')).get(id)!;

      const total = blank('total', 'Total');
      for (const v of visits) {
        const row = rowFor(v.therapistId);
        for (const r of [row, total]) {
          r.billPaise += v.actualBillPaise;
          r.bmSharePaise += v.bmSharePaise;
          r.tdsPaise += v.tdsPaise;
          r.postTaxPaise += v.postTaxPaise;
          r.hvPaise += v.hvPaise;
          r.adjustmentPaise += v.adjustmentPaise;
          r.visitCount += 1;
        }
        if (!patientsByTherapist.has(v.therapistId)) patientsByTherapist.set(v.therapistId, new Set());
        patientsByTherapist.get(v.therapistId)!.add(v.patientId);
        allPatients.add(v.patientId);
      }
      for (const [id, set] of patientsByTherapist) rowsById.get(id)!.uniquePatients = set.size;
      total.uniquePatients = allPatients.size;

      // Internal therapist splits: move a share of the billed amount from the
      // primary to an assisting therapist. Nets to zero, so no billed total
      // above is affected — this is attribution only.
      for (const v of visits) {
        if (!v.sharedTherapistId || !v.sharedPct) continue;
        const sharedAmt = Math.round((v.actualBillPaise * v.sharedPct) / 100);
        rowFor(v.therapistId).sharedPaise -= sharedAmt;
        rowFor(v.sharedTherapistId).sharedPaise += sharedAmt;
        // total.sharedPaise stays 0 — the − and + are equal and opposite
      }

      const rows = [...rowsById.values()].sort((a, b) =>
        a.therapistName.localeCompare(b.therapistName)
      );
      return {
        month,
        title: `${monthName(month.month)} ${month.year}`,
        rows,
        total,
      };
    },

    toCsv(report: MonthlyReport): string {
      const header = [
        'Therapist',
        'Bill Amount',
        'BM Share',
        'TDS Deducted',
        'Post Tax BM',
        'HV Share',
        'Shared',
        'Visits',
        'Patients',
      ];
      const line = (r: TherapistMonthRow) => [
        r.therapistName,
        paiseToRupees(r.billPaise),
        paiseToRupees(r.bmSharePaise),
        paiseToRupees(r.tdsPaise),
        paiseToRupees(r.postTaxPaise),
        paiseToRupees(r.hvPaise),
        paiseToRupees(r.sharedPaise),
        r.visitCount,
        r.uniquePatients,
      ];
      return [header, ...report.rows.map(line), line(report.total)]
        .map((cells) => cells.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(','))
        .join('\n');
    },
  };
}
