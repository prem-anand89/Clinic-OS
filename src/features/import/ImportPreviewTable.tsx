import { useMemo } from 'react';
import type { CatalogItem } from '@/domain/types';
import { formatINR } from '@/domain/money';
import type { ImportPreview, PreviewRow, Resolutions, RowResolution } from '@/services/importVisitsService';
import { inputCls, td, th } from '@/components/ui';

const ISSUE_LABEL: Record<string, string> = {
  'bad-date': 'Bad date',
  'unknown-therapist': 'Unknown therapist',
  'unmatched-service': 'Unmatched service',
  'package-anomaly': 'Package billing unclear',
};

function isRowResolved(row: PreviewRow, resolution: RowResolution | undefined): boolean {
  if (resolution?.skip) return true;
  return row.blockingIssues.every((issue) => {
    if (issue === 'bad-date') return !!resolution?.visitDate;
    if (issue === 'unmatched-service') return !!resolution?.catalogItemId;
    if (issue === 'package-anomaly') return resolution?.setAsAnchor !== undefined;
    return false; // unknown-therapist has no fix control — must be skipped
  });
}

export function allRowsResolved(preview: ImportPreview, resolutions: Resolutions): boolean {
  return preview.rows.every((row) => row.blockingIssues.length === 0 || isRowResolved(row, resolutions[row.key]));
}

export function ImportPreviewTable({
  preview,
  resolutions,
  onResolutionChange,
  catalogItems,
  nameOverrides,
  onNameOverrideChange,
}: {
  preview: ImportPreview;
  resolutions: Resolutions;
  onResolutionChange: (key: string, patch: RowResolution) => void;
  catalogItems: CatalogItem[];
  nameOverrides: Record<string, string>;
  onNameOverrideChange: (mrno: string, name: string) => void;
}) {
  const flagged = preview.rows.filter((r) => r.blockingIssues.length > 0);
  const catalogByCategory = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const item of catalogItems) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return [...map.entries()];
  }, [catalogItems]);

  const ambiguousMrnos = useMemo(() => {
    const seen = new Map<string, PreviewRow>();
    for (const row of preview.rows) {
      if (row.patientNameAmbiguous && !seen.has(row.mrno)) seen.set(row.mrno, row);
    }
    return [...seen.values()];
  }, [preview.rows]);

  return (
    <div className="space-y-6">
      {flagged.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">
            Needs review ({flagged.length} row{flagged.length === 1 ? '' : 's'})
          </h3>
          <div className="overflow-x-auto rounded-lg border border-amber-200 bg-amber-50">
            <table className="min-w-full divide-y divide-amber-200">
              <thead>
                <tr>
                  <th className={th}>Row</th>
                  <th className={th}>Patient</th>
                  <th className={th}>Service (as typed)</th>
                  <th className={th}>Issue</th>
                  <th className={th}>Fix</th>
                  <th className={th}>Skip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {flagged.map((row) => {
                  const res = resolutions[row.key];
                  return (
                    <tr key={row.key}>
                      <td className={td}>
                        {row.raw.sheet} #{row.raw.sheetRowIndex + 1}
                      </td>
                      <td className={td}>
                        {row.patientNameCanonical} ({row.mrno})
                      </td>
                      <td className={td}>{row.raw.serviceNameRaw}</td>
                      <td className={td}>{row.blockingIssues.map((i) => ISSUE_LABEL[i]).join(', ')}</td>
                      <td className={`${td} min-w-48`}>
                        {res?.skip ? (
                          <span className="text-xs text-slate-400">Skipped</span>
                        ) : (
                          <>
                            {row.blockingIssues.includes('bad-date') && (
                              <input
                                type="date"
                                className={inputCls}
                                value={res?.visitDate ?? ''}
                                onChange={(e) => onResolutionChange(row.key, { visitDate: e.target.value })}
                              />
                            )}
                            {row.blockingIssues.includes('unmatched-service') && (
                              <select
                                className={inputCls}
                                value={res?.catalogItemId ?? ''}
                                onChange={(e) => onResolutionChange(row.key, { catalogItemId: e.target.value })}
                              >
                                <option value="">Select a catalog item…</option>
                                {catalogByCategory.map(([category, items]) => (
                                  <optgroup key={category} label={category}>
                                    {items.map((i) => (
                                      <option key={i.id} value={i.id}>
                                        {i.name} — {formatINR(i.basePricePaise)}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            )}
                            {(row.blockingIssues.includes('package-anomaly') ||
                              row.blockingIssues.includes('unknown-therapist')) && (
                              <span className="text-xs text-slate-500">Skip to resolve →</span>
                            )}
                          </>
                        )}
                      </td>
                      <td className={td}>
                        <input
                          type="checkbox"
                          checked={!!res?.skip}
                          onChange={(e) => onResolutionChange(row.key, { skip: e.target.checked })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ambiguousMrnos.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">
            Inconsistent patient name spelling ({ambiguousMrnos.length}) — optional, fixable later in
            Patients too
          </h3>
          <div className="space-y-1">
            {ambiguousMrnos.map((row) => (
              <div key={row.mrno} className="flex items-center gap-2 text-sm">
                <span className="w-20 text-slate-500">{row.mrno}</span>
                <select
                  className={inputCls}
                  value={nameOverrides[row.mrno] ?? row.patientNameCanonical}
                  onChange={(e) => onNameOverrideChange(row.mrno, e.target.value)}
                >
                  {row.patientNameVariants.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-800">All rows ({preview.rows.length})</h3>
        <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Patient</th>
                <th className={th}>MRNO</th>
                <th className={th}>Therapist</th>
                <th className={th}>Service</th>
                <th className={th}>Bill</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {preview.rows.map((row) => (
                <tr key={row.key} className={row.blockingIssues.length ? 'bg-amber-50' : ''}>
                  <td className={td}>{row.visitDate ?? '—'}</td>
                  <td className={td}>{row.patientNameCanonical}</td>
                  <td className={td}>{row.mrno}</td>
                  <td className={td}>{row.raw.therapistName}</td>
                  <td className={td}>{row.raw.serviceNameRaw}</td>
                  <td className={td}>{formatINR(row.billAmountPaise)}</td>
                  <td className={td}>
                    {resolutions[row.key]?.skip
                      ? 'Skipped'
                      : row.blockingIssues.length
                        ? isRowResolved(row, resolutions[row.key])
                          ? 'Resolved'
                          : 'Needs review'
                        : 'OK'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
