# Clinic OS — Patient Visit Ledger

Offline-first visit ledger, revenue-split tracker, and invoice book for
physiotherapy clinics operating inside a partner hospital. Built for
Beyond Mechanics @ Health Valley, structured multi-clinic from day one.

**Stack:** React + Vite + TypeScript · Supabase (Postgres/Auth/Realtime/Storage)
· Dexie (IndexedDB) local-first store with outbox sync · Tailwind CSS.

## What it does (Phase 1)

- **Visit ledger** — patient lookup by MRNO/name (create-if-missing, walk-in
  MRNO auto-generation), visit entry with catalog price autofill, price
  override with mandatory adjustment reason (the catalog never changes from a
  discount), package session tracking (1/3, 2/3 … with ₹0 continuations),
  filterable visit table.
- **Revenue split** — per visit, computed at billing time and stored with the
  rate snapshot: BM Share (75%), Post-Tax (90% of share), TDS (configurable
  basis: % of gross bill, matching the current HV sheet, or % of BM share), HV
  share. Rounding: half-up to the rupee, once per visit — rollups reconcile by
  construction.
- **Monthly report** — fiscal-year-aware (Apr–Mar), per-therapist Bill / BM
  Share / TDS / Post-Tax / HV / unique patients + total, CSV export.
- **Invoices** — server-issued, gap-free sequential numbers per clinic per FY
  (`BM/26-27/0001`), immutable once issued (DB triggers), printable A4/A5 with
  clinic letterhead + optional partner-hospital branding.
- **Offline-first** — all entry works offline; changes queue in an outbox and
  sync when a connection returns. Invoice issuance is deliberately online-only
  (gap-free numbers need the server counter).

## Architecture

```
src/domain/        pure business logic (money, splits, fiscal year) — no framework imports, unit-tested
src/repositories/  data-access interfaces + Dexie implementations (UI reads/writes local only)
src/sync/          outbox push / delta pull engine against Supabase
src/services/      visit/invoice/report/patient orchestration — no React imports
src/features/      UI (React + TanStack Router)
supabase/          SQL migrations (schema, RLS, RPCs), seed
```

Business logic never imports Supabase or Dexie — swapping the backend means
reimplementing the repository interfaces, nothing above them.

## One-time setup

1. Create a Supabase project (free tier is fine).
2. Apply the migration: paste `supabase/migrations/*.sql` into the SQL editor
   (or `supabase db push` with the CLI), then run `supabase/seed.sql`.
3. Create the two auth users (Authentication → Users → Add user), then run
   `supabase/setup_members.sql` with their real emails to grant clinic access.
4. `cp .env.example .env` and fill in the project URL + anon key
   (Project Settings → API).
5. `npm install && npm run dev`

## Development

| Command             | What                          |
| ------------------- | ----------------------------- |
| `npm run dev`       | dev server on :5173           |
| `npm test`          | unit tests (domain + services) |
| `npm run typecheck` | strict TS                     |
| `npm run lint`      | eslint                        |
| `npm run build`     | production build              |
| `npm run e2e`       | Playwright smoke              |

## Security & data notes

- Every table carries `clinic_id`; RLS restricts all access to clinic members.
  Patient data is health data — there is no anonymous read path.
- Issued invoices and their visits are frozen by DB triggers; corrections are
  a future amendment/credit-note feature, not edits.
- Rate/tax changes in Setup apply to new visits only; history keeps the rates
  it was billed under.
- Export monthly CSVs — this app should never be the only copy of financial
  records.
