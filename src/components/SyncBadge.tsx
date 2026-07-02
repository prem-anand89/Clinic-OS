import { useSyncExternalStore } from 'react';
import { syncStatus } from '@/sync/status';
import { syncEngine } from '@/sync/engine';

export function SyncBadge() {
  const status = useSyncExternalStore(syncStatus.subscribe, () => syncStatus.get());

  const dot = !status.online
    ? 'bg-amber-500'
    : status.error
      ? 'bg-red-500'
      : status.pending > 0 || status.syncing
        ? 'bg-blue-500 animate-pulse'
        : 'bg-emerald-500';

  const label = !status.online
    ? `Offline${status.pending ? ` · ${status.pending} pending` : ''}`
    : status.syncing
      ? 'Syncing…'
      : status.error
        ? 'Sync error'
        : status.pending > 0
          ? `${status.pending} pending`
          : 'Synced';

  return (
    <button
      type="button"
      onClick={() => syncEngine.schedule(0)}
      title={status.error ?? 'Click to sync now'}
      className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </button>
  );
}
