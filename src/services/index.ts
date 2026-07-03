import { repos } from '@/repositories/local';
import { createPatientService } from './patientService';
import { createVisitService } from './visitService';
import { createInvoiceService } from './invoiceService';
import { createReportService } from './reportService';
import { createImportVisitsService } from './importVisitsService';

export const patientService = createPatientService(repos);
export const visitService = createVisitService(repos);
export const invoiceService = createInvoiceService(repos);
export const reportService = createReportService(repos);
export const importVisitsService = createImportVisitsService(repos);
export { repos };
