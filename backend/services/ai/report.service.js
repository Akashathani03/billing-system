import crypto from 'crypto';
import Shop from '../../models/Shop.js';
import { listInvoices, getPaymentTotals, getTopProducts, getCustomersWithOutstandingBalance } from '../invoice.service.js';
import { getMonthlySales, getMonthlySalesForYear } from '../dashboard.service.js';
import { renderReportPdf, formatMoney, formatDate } from '../pdf.service.js';
import { formatBusinessDateKey } from '../../utils/businessDate.js';

export class ReportError extends Error {}

// Same "no prototype-pollution surface" reasoning as tools/index.js's
// TOOL_MAP: a plain allowlist of exactly these five report types, looked
// up by exact key, never dynamic dispatch on arbitrary input.
const REPORT_TYPES = new Set(['bills', 'payments', 'sales', 'top_products', 'outstanding_customers']);

// Defense in depth against a huge PDF: bounded independently of whatever a
// caller asks for. listInvoices/getTopProducts already cap internally too
// (see invoice.service.js), but outstanding-customer balances have no
// internal cap, so this is enforced here for that case.
const MAX_TABLE_ROWS = 50;

function periodLabelFor({ dateFrom, dateTo, year, month, monthLabel }) {
  if (year && month) return `${monthLabel ?? month} ${year}`;
  if (year) return `Year ${year}`;
  if (dateFrom && dateTo) return `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;
  if (dateFrom) return `From ${formatDate(dateFrom)}`;
  if (dateTo) return `Until ${formatDate(dateTo)}`;
  return 'All time';
}

async function buildBillsReport({ shopId, dateFrom, dateTo, paymentStatus }) {
  const { invoices, total } = await listInvoices({ status: 'finalized', paymentStatus, dateFrom, dateTo, limit: MAX_TABLE_ROWS }, shopId);

  const paidInvoices = invoices.filter((inv) => inv.paymentStatus === 'paid');
  const pendingInvoices = invoices.filter((inv) => inv.paymentStatus === 'pending');
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const paidAmount = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);

  return {
    title: 'Billing Report',
    periodLabel: periodLabelFor({ dateFrom, dateTo }),
    summary: [
      { label: 'Total Bills', value: String(invoices.length) },
      { label: 'Paid Bills', value: String(paidInvoices.length) },
      { label: 'Pending Bills', value: String(pendingInvoices.length) },
      { label: 'Total Amount', value: formatMoney(totalAmount) },
      { label: 'Paid Amount', value: formatMoney(paidAmount) },
      { label: 'Pending Amount', value: formatMoney(totalAmount - paidAmount) },
    ],
    columns: [
      { key: 'invoiceNumber', label: 'Invoice No', width: 95 },
      { key: 'date', label: 'Date', width: 75 },
      { key: 'customer', label: 'Customer', width: 165 },
      { key: 'amount', label: 'Amount', width: 90, align: 'right' },
      { key: 'status', label: 'Status', width: 70, align: 'right' },
    ],
    rows: invoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber || '-',
      date: inv.finalizedAt ? formatDate(inv.finalizedAt) : '-',
      customer: inv.customer?.name || '-',
      amount: formatMoney(inv.total),
      status: inv.paymentStatus === 'paid' ? 'Paid' : 'Pending',
    })),
    // Honest about the cap: the summary above is computed only from the
    // rows actually shown, never a separately-fetched, possibly
    // inconsistent "true total" beyond MAX_TABLE_ROWS.
    note: total > invoices.length ? `Showing the ${invoices.length} most recent of ${total} matching bills.` : null,
  };
}

async function buildPaymentsReport({ shopId, dateFrom, dateTo }) {
  const filter = dateFrom || dateTo ? { finalizedAt: dateRangeExpr(dateFrom, dateTo) } : {};
  const totals = await getPaymentTotals(filter, shopId);
  const collected = totals.cash + totals.upi + totals.card + totals.credit;
  const paid = collected - totals.pending;

  return {
    title: 'Payments Report',
    periodLabel: periodLabelFor({ dateFrom, dateTo }),
    summary: [
      { label: 'Total Billed (paid + pending)', value: formatMoney(collected) },
      { label: 'Paid Amount', value: formatMoney(paid) },
      { label: 'Pending Amount', value: formatMoney(totals.pending) },
    ],
    columns: [
      { key: 'method', label: 'Payment Method', width: 300 },
      { key: 'amount', label: 'Amount', width: 145, align: 'right' },
    ],
    rows: [
      { method: 'Cash', amount: formatMoney(totals.cash) },
      { method: 'UPI', amount: formatMoney(totals.upi) },
      { method: 'Card', amount: formatMoney(totals.card) },
      { method: 'Credit', amount: formatMoney(totals.credit) },
      { method: 'Pending (not yet collected)', amount: formatMoney(totals.pending) },
    ],
  };
}

function dateRangeExpr(dateFrom, dateTo) {
  const range = {};
  if (dateFrom) range.$gte = new Date(dateFrom);
  if (dateTo) range.$lt = new Date(new Date(dateTo).getTime() + 24 * 60 * 60 * 1000);
  return range;
}

async function buildSalesReport({ shopId, year, month }) {
  let months;
  if (year) {
    const all = await getMonthlySalesForYear(year, shopId);
    months = month ? all.filter((m) => m.month === month) : all;
  } else {
    months = await getMonthlySales(shopId);
  }

  const totalBills = months.reduce((sum, m) => sum + m.bills, 0);
  const totalSales = months.reduce((sum, m) => sum + m.sales, 0);

  return {
    title: 'Sales Report',
    periodLabel: periodLabelFor({ year, month, monthLabel: months[0]?.label }),
    summary: [
      { label: 'Total Bills', value: String(totalBills) },
      { label: 'Total Sales', value: formatMoney(totalSales) },
    ],
    columns: [
      { key: 'period', label: 'Period', width: 270 },
      { key: 'bills', label: 'Bills', width: 85, align: 'right' },
      { key: 'sales', label: 'Sales Amount', width: 90, align: 'right' },
    ],
    rows: months.map((m) => ({ period: m.label, bills: String(m.bills), sales: formatMoney(m.sales) })),
  };
}

async function buildTopProductsReport({ shopId, dateFrom, dateTo, limit }) {
  const products = await getTopProducts(shopId, { limit: Math.min(limit ?? 20, MAX_TABLE_ROWS), dateFrom, dateTo });

  return {
    title: 'Top Products Report',
    periodLabel: periodLabelFor({ dateFrom, dateTo }),
    summary: [{ label: 'Products Shown', value: String(products.length) }],
    columns: [
      { key: 'product', label: 'Product', width: 210 },
      { key: 'quantity', label: 'Quantity Sold', width: 100, align: 'right' },
      { key: 'sales', label: 'Sales Amount', width: 105, align: 'right' },
      { key: 'timesSold', label: 'Times Sold', width: 80, align: 'right' },
    ],
    rows: products.map((p) => ({
      product: p.productName,
      quantity: p.unit ? `${p.totalQuantity} ${p.unit}` : String(p.totalQuantity),
      sales: formatMoney(p.totalSales),
      timesSold: String(p.timesSold),
    })),
  };
}

async function buildOutstandingCustomersReport({ shopId }) {
  const all = await getCustomersWithOutstandingBalance(shopId);
  const rows = all.slice(0, MAX_TABLE_ROWS);
  const totalOutstanding = all.reduce((sum, c) => sum + c.outstandingAmount, 0);

  return {
    title: 'Outstanding Customers Report',
    periodLabel: `As of ${formatDate(new Date())}`,
    summary: [
      { label: 'Customers Owing Money', value: String(all.length) },
      { label: 'Total Outstanding', value: formatMoney(totalOutstanding) },
    ],
    columns: [
      { key: 'customer', label: 'Customer', width: 130 },
      { key: 'mobile', label: 'Mobile', width: 95 },
      { key: 'total', label: 'Total Billed', width: 95, align: 'right' },
      { key: 'paid', label: 'Paid', width: 90, align: 'right' },
      { key: 'outstanding', label: 'Outstanding', width: 85, align: 'right' },
    ],
    rows: rows.map((c) => ({
      customer: c.name,
      mobile: c.mobile,
      total: formatMoney(c.totalAmount),
      paid: formatMoney(c.paidAmount),
      outstanding: formatMoney(c.outstandingAmount),
    })),
    note: all.length > rows.length ? `Showing the top ${rows.length} of ${all.length} customers by amount owed.` : null,
  };
}

const REPORT_BUILDERS = {
  bills: buildBillsReport,
  payments: buildPaymentsReport,
  sales: buildSalesReport,
  top_products: buildTopProductsReport,
  outstanding_customers: buildOutstandingCustomersReport,
};

const FILENAME_PREFIX = {
  bills: 'billing-report',
  payments: 'payments-report',
  sales: 'sales-report',
  top_products: 'top-products-report',
  outstanding_customers: 'outstanding-customers-report',
};

/** Strips everything except letters/digits/hyphens — no "/", "\", "..", or any other path component can ever survive this. */
function sanitizeFilenamePart(value) {
  return String(value ?? '').replace(/[^a-zA-Z0-9-]/g, '');
}

function buildFilename(reportType, { dateFrom, year, month }) {
  let slug;
  if (year && month) slug = `${year}-${String(month).padStart(2, '0')}`;
  else if (year) slug = String(year);
  else if (dateFrom) slug = String(dateFrom).slice(0, 7);
  else slug = formatBusinessDateKey(new Date());

  const safeSlug = sanitizeFilenamePart(slug) || 'report';
  return `${FILENAME_PREFIX[reportType]}-${safeSlug}.pdf`;
}

// In-memory only, by design: a generated report is a disposable, on-demand
// artifact (regenerating it is cheap), never a filesystem path, so there is
// nothing for a path-traversal or arbitrary-file-read attempt to reach.
// This is a first-version, single-process store — see report.service.js's
// implementation report for the tradeoffs of that choice.
const REPORT_TTL_MS = 15 * 60 * 1000;
const MAX_STORED_REPORTS = 200;
const reportStore = new Map();

function pruneReportStore() {
  const now = Date.now();
  for (const [id, entry] of reportStore) {
    if (now - entry.createdAt > REPORT_TTL_MS) reportStore.delete(id);
  }
  if (reportStore.size > MAX_STORED_REPORTS) {
    const oldestFirst = [...reportStore.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
    for (const [id] of oldestFirst.slice(0, reportStore.size - MAX_STORED_REPORTS)) {
      reportStore.delete(id);
    }
  }
}

/**
 * Generates one of the five allowlisted report types as a PDF, scoped
 * strictly to `shopId` (always the authenticated caller's own shop — see
 * tools/reportTools.js, which is the only intended caller). Returns a
 * small, structured description — never the PDF bytes themselves — with a
 * reportId that only getReport(reportId, shopId) can redeem, and only for
 * that same shop.
 */
export async function generateReport({ reportType, shopId, ...filters }) {
  if (!shopId) {
    throw new Error('generateReport requires an authenticated shopId');
  }
  const build = REPORT_BUILDERS[reportType];
  if (!REPORT_TYPES.has(reportType) || !build) {
    throw new ReportError(`Unknown report type: ${reportType}`);
  }

  const [shopConfig, content] = await Promise.all([Shop.findById(shopId), build({ shopId, ...filters })]);

  const buffer = await renderReportPdf({
    shopConfig: shopConfig ?? {},
    generatedAt: new Date(),
    ...content,
  });

  const filename = buildFilename(reportType, filters);

  pruneReportStore();
  const reportId = crypto.randomUUID();
  reportStore.set(reportId, { shopId, buffer, filename, contentType: 'application/pdf', createdAt: Date.now() });

  return { reportId, filename, reportType };
}

/**
 * Redeems a previously generated report. Returns null for a nonexistent,
 * expired, or evicted report id, and — critically — also null when the
 * report belongs to a different shop, so the two cases are indistinguishable
 * to the caller and a shop can never learn anything about another shop's
 * report just by trying ids.
 */
export function getReport(reportId, shopId) {
  pruneReportStore();
  const entry = reportStore.get(reportId);
  if (!entry || entry.shopId !== shopId) return null;
  return entry;
}

/** Test-only: empties the in-memory report store between test cases. */
export function _testOnlyClearReports() {
  reportStore.clear();
}
