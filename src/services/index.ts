import { repos } from '@/repositories/local';
import { createPatientService } from './patientService';
import { createVisitService } from './visitService';
import { createInvoiceService } from './invoiceService';
import { createReportService } from './reportService';
import { createImportVisitsService } from './importVisitsService';
import { createPaymentService } from './paymentService';
import { createSettlementService } from './settlementService';
import { createDashboardService } from './dashboardService';

export const patientService = createPatientService(repos);
export const visitService = createVisitService(repos);
export const invoiceService = createInvoiceService(repos);
export const reportService = createReportService(repos);
export const importVisitsService = createImportVisitsService(repos);
export const paymentService = createPaymentService(repos);
export const settlementService = createSettlementService(repos);
export const dashboardService = createDashboardService(repos);
export { repos };
