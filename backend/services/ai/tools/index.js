import { listInvoices, getPaymentTotals, getTopProducts, getCustomersWithOutstandingBalance } from '../../invoice.service.js';
import { getMonthlySales, getMonthlySalesForYear } from '../../dashboard.service.js';
import { retrieveKnowledge } from '../knowledge.service.js';
import { reportTools } from './reportTools.js';
import {
  ToolValidationError,
  assertOptionalDate,
  assertOptionalInt,
  assertOptionalEnum,
  assertOptionalString,
  buildDateRangeFilter,
} from './validators.js';

export { ToolValidationError };

// Defense in depth: even if a tool's underlying query could return more,
// never hand the model more rows than it needs to answer a chat question.
const MAX_RESULT_ROWS = 20;

/** Trims a bill down to what's actually useful to answer a chat question — never the raw Mongoose document. */
function toPublicBill(invoice) {
  return {
    invoiceNumber: invoice.invoiceNumber || null,
    status: invoice.status,
    customerName: invoice.customer?.name,
    total: invoice.total,
    paymentMethod: invoice.paymentMethod,
    paymentStatus: invoice.paymentStatus,
    finalizedAt: invoice.finalizedAt,
  };
}

const DATE_RANGE_PARAMS = {
  dateFrom: { type: 'STRING', description: 'ISO date (YYYY-MM-DD), inclusive start of the range.' },
  dateTo: { type: 'STRING', description: 'ISO date (YYYY-MM-DD), inclusive end of the range.' },
};

/**
 * The full set of allowlisted tools: Gemini can never call anything outside
 * this object, and no tool here accepts (or even declares) a shopId
 * parameter — it always arrives as executeTool()'s own `shopId` argument,
 * sourced from the authenticated caller, never from `args`.
 */
const TOOLS = {
  get_bills: {
    description:
      "List the shop's bills (invoices), optionally filtered by status, payment status, a date range, or a text search on invoice number / customer name / mobile.",
    parameters: {
      type: 'OBJECT',
      properties: {
        status: {
          type: 'STRING',
          enum: ['draft', 'finalized', 'cancelled'],
          description: 'Defaults to "finalized" (an actual bill) if omitted.',
        },
        paymentStatus: { type: 'STRING', enum: ['paid', 'pending'] },
        ...DATE_RANGE_PARAMS,
        search: { type: 'STRING', description: 'Free-text match on invoice number, customer name, or mobile number.' },
        limit: { type: 'INTEGER', description: 'Max number of bills to return (default 20, max 50).' },
      },
    },
    validate(args = {}) {
      return {
        status: assertOptionalEnum(args.status, 'status', ['draft', 'finalized', 'cancelled']) ?? 'finalized',
        paymentStatus: assertOptionalEnum(args.paymentStatus, 'paymentStatus', ['paid', 'pending']),
        dateFrom: assertOptionalDate(args.dateFrom, 'dateFrom'),
        dateTo: assertOptionalDate(args.dateTo, 'dateTo'),
        search: assertOptionalString(args.search, 'search', { maxLength: 100 }),
        limit: assertOptionalInt(args.limit, 'limit', { min: 1, max: 50 }),
      };
    },
    async execute(args, shopId) {
      const { invoices, total } = await listInvoices(args, shopId);
      return { total, bills: invoices.slice(0, MAX_RESULT_ROWS).map(toPublicBill) };
    },
  },

  get_payment_totals: {
    description:
      'Total money collected, broken down by payment method (cash/upi/card/credit), plus the total still pending, over an optional date range.',
    parameters: { type: 'OBJECT', properties: { ...DATE_RANGE_PARAMS } },
    validate(args = {}) {
      return {
        dateFrom: assertOptionalDate(args.dateFrom, 'dateFrom'),
        dateTo: assertOptionalDate(args.dateTo, 'dateTo'),
      };
    },
    async execute(args, shopId) {
      return getPaymentTotals(buildDateRangeFilter(args), shopId);
    },
  },

  get_outstanding_amount: {
    description: "The shop's total outstanding (pending, not yet paid) amount across finalized bills, optionally over a date range.",
    parameters: { type: 'OBJECT', properties: { ...DATE_RANGE_PARAMS } },
    validate(args = {}) {
      return {
        dateFrom: assertOptionalDate(args.dateFrom, 'dateFrom'),
        dateTo: assertOptionalDate(args.dateTo, 'dateTo'),
      };
    },
    async execute(args, shopId) {
      const totals = await getPaymentTotals(buildDateRangeFilter(args), shopId);
      return { outstandingAmount: totals.pending };
    },
  },

  get_sales_by_month: {
    description:
      'Finalized sales totals by month. Pass "year" (optionally with "month") for a specific calendar period, or "monthsBack" for the most recent N months.',
    parameters: {
      type: 'OBJECT',
      properties: {
        year: { type: 'INTEGER', description: 'Calendar year, e.g. 2026.' },
        month: { type: 'INTEGER', description: 'Month number 1-12. Only used together with "year".' },
        monthsBack: {
          type: 'INTEGER',
          description: 'Number of most recent months to return (e.g. 3 for "last 3 months"). Ignored if "year" is set.',
        },
      },
    },
    validate(args = {}) {
      return {
        year: assertOptionalInt(args.year, 'year', { min: 2000, max: 2100 }),
        month: assertOptionalInt(args.month, 'month', { min: 1, max: 12 }),
        monthsBack: assertOptionalInt(args.monthsBack, 'monthsBack', { min: 1, max: 12 }),
      };
    },
    async execute({ year, month, monthsBack }, shopId) {
      if (year) {
        const months = await getMonthlySalesForYear(year, shopId);
        return { months: month ? months.filter((m) => m.month === month) : months };
      }
      const months = await getMonthlySales(shopId);
      return { months: monthsBack ? months.slice(0, monthsBack) : months };
    },
  },

  get_top_products: {
    description: 'The best-selling products by quantity sold, optionally over a date range.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'INTEGER', description: 'Max number of products to return (default 10, max 50).' },
        ...DATE_RANGE_PARAMS,
      },
    },
    validate(args = {}) {
      return {
        limit: assertOptionalInt(args.limit, 'limit', { min: 1, max: 50 }),
        dateFrom: assertOptionalDate(args.dateFrom, 'dateFrom'),
        dateTo: assertOptionalDate(args.dateTo, 'dateTo'),
      };
    },
    async execute(args, shopId) {
      const products = await getTopProducts(shopId, args);
      return { products: products.slice(0, MAX_RESULT_ROWS) };
    },
  },

  get_customers_with_outstanding_balance: {
    description: 'Customers who currently owe the shop money (unpaid finalized bills), with how much each owes.',
    parameters: { type: 'OBJECT', properties: {} },
    validate() {
      return {};
    },
    async execute(_args, shopId) {
      const customers = await getCustomersWithOutstandingBalance(shopId);
      return {
        customers: customers
          .slice(0, MAX_RESULT_ROWS)
          .map((c) => ({ name: c.name, mobile: c.mobile, outstandingAmount: c.outstandingAmount })),
      };
    },
  },

  retrieve_knowledge: {
    description:
      "Look up general how-to / product-knowledge information about using this billing system — for example how to create a bill, add a customer or product, or what a term like 'pending' means. This is static documentation, not live shop data, and takes no shop-specific arguments.",
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: "The user's question or topic, in their own words." },
      },
      required: ['query'],
    },
    validate(args = {}) {
      const query = assertOptionalString(args.query, 'query', { maxLength: 300 });
      if (!query || !query.trim()) {
        throw new ToolValidationError('"query" is required');
      }
      return { query };
    },
    // shopId is intentionally never used here — the knowledge base is
    // static, shop-agnostic documentation, not shop-owned data.
    async execute({ query }) {
      const result = retrieveKnowledge(query);
      if (!result.found) {
        return { found: false, message: 'No relevant documentation found for this query.' };
      }
      return { found: true, results: result.chunks.map(({ heading, text }) => ({ heading, text })) };
    },
  },

  ...reportTools,
};

const TOOL_MAP = new Map(Object.entries(TOOLS));

export const ALLOWLISTED_TOOL_NAMES = Object.freeze([...TOOL_MAP.keys()]);

/** The function declarations Gemini is given — description + parameter schema only, nothing executable. */
export function getToolDeclarations() {
  return ALLOWLISTED_TOOL_NAMES.map((name) => {
    const tool = TOOL_MAP.get(name);
    return { name, description: tool.description, parameters: tool.parameters };
  });
}

/**
 * Validates and executes exactly one allowlisted tool. `shopId` always
 * comes from the caller (ultimately req.user.shopId, verified by auth
 * middleware) — it is never read from `args`, and no tool's declared
 * schema even has a shopId property, so there is no argument name Gemini
 * could populate to influence which shop's data gets queried. A `Map`
 * lookup (rather than plain-object property access) is used deliberately
 * so a crafted tool name like "constructor" or "__proto__" can never
 * resolve to anything via the prototype chain.
 */
export async function executeTool(name, args, shopId) {
  if (typeof name !== 'string' || !TOOL_MAP.has(name)) {
    throw new ToolValidationError(`Unknown tool: ${name}`);
  }
  const tool = TOOL_MAP.get(name);
  const cleanArgs = tool.validate(args && typeof args === 'object' ? args : {});
  return tool.execute(cleanArgs, shopId);
}
