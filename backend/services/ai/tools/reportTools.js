import { generateReport } from '../report.service.js';
import { ToolValidationError, assertOptionalDate, assertOptionalInt, assertOptionalEnum } from './validators.js';

const REPORT_TYPES = ['bills', 'payments', 'sales', 'top_products', 'outstanding_customers'];

/**
 * A single tool, kept in its own file per the task's suggested structure —
 * merged into tools/index.js's central TOOLS/allowlist (see the `...reportTools`
 * spread there), not a second, parallel tool-calling mechanism.
 *
 * No property here is `shopId`, a filesystem path, or a filename — the enum
 * on `reportType` is the only thing that picks *what* gets generated;
 * *where* it's stored and what it's named are entirely backend-decided
 * inside report.service.js and never influenced by the model's arguments.
 */
export const reportTools = {
  generate_billing_report: {
    description:
      'Generates a downloadable PDF report of this shop\'s billing data — bills, payments, sales, top products, or customers who owe money. Returns a small description of the generated report (not the PDF itself); the report itself is fetched separately via its reportId.',
    parameters: {
      type: 'OBJECT',
      properties: {
        reportType: {
          type: 'STRING',
          enum: REPORT_TYPES,
          description:
            '"bills" (a list of bills), "payments" (payment totals by method), "sales" (sales by month), "top_products" (best-selling products), or "outstanding_customers" (who owes money).',
        },
        dateFrom: { type: 'STRING', description: 'ISO date (YYYY-MM-DD), inclusive start. Used by bills/payments/top_products.' },
        dateTo: { type: 'STRING', description: 'ISO date (YYYY-MM-DD), inclusive end. Used by bills/payments/top_products.' },
        year: { type: 'INTEGER', description: 'Calendar year, e.g. 2026. Used by the sales report.' },
        month: { type: 'INTEGER', description: 'Month number 1-12, only together with "year". Used by the sales report.' },
        paymentStatus: { type: 'STRING', enum: ['paid', 'pending'], description: 'Restricts the bills report to only paid or only pending bills.' },
        limit: { type: 'INTEGER', description: 'Max rows for the top_products report (default 20, max 50).' },
      },
      required: ['reportType'],
    },
    validate(args = {}) {
      const reportType = assertOptionalEnum(args.reportType, 'reportType', REPORT_TYPES);
      if (!reportType) {
        throw new ToolValidationError('"reportType" is required');
      }
      return {
        reportType,
        dateFrom: assertOptionalDate(args.dateFrom, 'dateFrom'),
        dateTo: assertOptionalDate(args.dateTo, 'dateTo'),
        year: assertOptionalInt(args.year, 'year', { min: 2000, max: 2100 }),
        month: assertOptionalInt(args.month, 'month', { min: 1, max: 12 }),
        paymentStatus: assertOptionalEnum(args.paymentStatus, 'paymentStatus', ['paid', 'pending']),
        limit: assertOptionalInt(args.limit, 'limit', { min: 1, max: 50 }),
      };
    },
    async execute(args, shopId) {
      const { reportId, filename, reportType } = await generateReport({ ...args, shopId });
      return { success: true, reportType, filename, reportId };
    },
  },
};
