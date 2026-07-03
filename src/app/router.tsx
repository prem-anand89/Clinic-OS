import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import { Shell } from './Shell';
import { VisitsPage } from '@/features/visits/VisitsPage';
import { NewVisitPage } from '@/features/visits/NewVisitPage';
import { PatientsPage } from '@/features/patients/PatientsPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { MonthlyLedgerPrintPage } from '@/features/reports/MonthlyLedgerPrintPage';
import { InvoicesPage } from '@/features/invoices/InvoicesPage';
import { InvoicePrintPage } from '@/features/invoices/InvoicePrintPage';
import { SetupPage } from '@/features/setup/SetupPage';
import { ImportVisitsPage } from '@/features/import/ImportVisitsPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';

const rootRoute = createRootRoute({ component: Shell });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/visits' });
  },
});

const visitsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/visits',
  validateSearch: (search: Record<string, unknown>): { patientId?: string } =>
    typeof search.patientId === 'string' ? { patientId: search.patientId } : {},
  component: VisitsPage,
});

const newVisitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/visits/new',
  component: NewVisitPage,
});

const patientsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/patients',
  component: PatientsPage,
});

const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reports',
  component: ReportsPage,
});

const reportsPrintRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reports/print',
  validateSearch: (search: Record<string, unknown>): { year: number; month: number } => ({
    year: Number(search.year) || new Date().getFullYear(),
    month: Number(search.month) || new Date().getMonth() + 1,
  }),
  component: MonthlyLedgerPrintPage,
});

const invoicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invoices',
  component: InvoicesPage,
});

const invoicePrintRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invoices/$invoiceId/print',
  component: InvoicePrintPage,
});

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup',
  component: SetupPage,
});

const importVisitsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup/import-visits',
  component: ImportVisitsPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  visitsRoute,
  newVisitRoute,
  patientsRoute,
  reportsRoute,
  reportsPrintRoute,
  invoicesRoute,
  invoicePrintRoute,
  setupRoute,
  importVisitsRoute,
  dashboardRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
