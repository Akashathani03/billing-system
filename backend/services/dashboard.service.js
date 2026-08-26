import Invoice from '../models/Invoice.js';
import { getPaymentTotals } from './invoice.service.js';
import {
  getBusinessDayRangeUTC,
  getRecentBusinessDayRanges,
  formatBusinessDateKey,
  getRecentBusinessMonthRanges,
  formatBusinessMonthKey,
  getBusinessYearMonthRanges,
  getCurrentBusinessYear,
} from '../utils/businessDate.js';
import { BUSINESS_UTC_OFFSET, BUSINESS_TIMEZONE } from '../config/businessConfig.js';

const RECENT_BILLS_LIMIT = 5;
const TREND_DAYS = 7;
const MONTHLY_SALES_MONTHS = 12;

function formatMonthLabel(date) {
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: BUSINESS_TIMEZONE });
}

function formatMonthOnlyLabel(date) {
  return date.toLocaleDateString('en-IN', { month: 'long', timeZone: BUSINESS_TIMEZONE });
}

/** Shared aggregation used by both the rolling and calendar-year monthly views. */
async function aggregateSalesByMonth(rangeStart, rangeEnd) {
  const results = await Invoice.aggregate([
    { $match: { status: 'finalized', finalizedAt: { $gte: rangeStart, $lt: rangeEnd } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$finalizedAt', timezone: BUSINESS_UTC_OFFSET } },
        sales: { $sum: '$total' },
        bills: { $sum: 1 },
      },
    },
  ]);
  return new Map(results.map((r) => [r._id, { sales: r.sales, bills: r.bills }]));
}

/**
 * Finalized-invoice sales and bill counts for each of the last
 * MONTHLY_SALES_MONTHS business months (Asia/Kolkata), newest first. Sums
 * the invoice's already-stored `total` — never recalculated from current
 * product/customer data — and paymentStatus has no bearing on inclusion
 * (a pending finalized invoice is still a completed sale). A month with no
 * finalized invoices still appears, with sales 0 and bills 0, rather than
 * being omitted, so the history reads as a continuous timeline.
 *
 * This is a rolling window relative to "now", independent of any single
 * calendar year — it's the source for the "Last 12 Months" summary and is
 * unrelated to getMonthlySalesForYear below.
 */
export async function getMonthlySales() {
  const monthRanges = getRecentBusinessMonthRanges(MONTHLY_SALES_MONTHS);
  const rangeStart = monthRanges[0].start;
  const rangeEnd = monthRanges[monthRanges.length - 1].end;
  const byMonth = await aggregateSalesByMonth(rangeStart, rangeEnd);

  return monthRanges
    .map(({ start }) => {
      const month = formatBusinessMonthKey(start);
      const data = byMonth.get(month) || { sales: 0, bills: 0 };
      return { month, label: formatMonthLabel(start), sales: data.sales, bills: data.bills };
    })
    .reverse(); // monthRanges is oldest-first; the API response is newest-first
}

/**
 * All 12 calendar months (January-December) of `year`, business timezone.
 * Unlike getMonthlySales, this always covers a FIXED year — including
 * future months with zero sales if `year` is the current year — so
 * switching the year selector always shows a complete, consistent Jan-Dec
 * history rather than a moving window.
 */
export async function getMonthlySalesForYear(year) {
  const monthRanges = getBusinessYearMonthRanges(year);
  const rangeStart = monthRanges[0].start;
  const rangeEnd = monthRanges[monthRanges.length - 1].end;
  const byMonth = await aggregateSalesByMonth(rangeStart, rangeEnd);

  return monthRanges.map(({ start, monthNumber }) => {
    const key = formatBusinessMonthKey(start);
    const data = byMonth.get(key) || { sales: 0, bills: 0 };
    return { month: monthNumber, label: formatMonthOnlyLabel(start), sales: data.sales, bills: data.bills };
  });
}

const YEAR_BUFFER_BACK = 2;
const YEAR_BUFFER_FORWARD = 1;

/**
 * Years the shop could reasonably view sales history for: every distinct
 * year that has at least one finalized invoice, unioned with a fixed buffer
 * around the current business year (2 years back, 1 year ahead) — so the
 * selector always has a sensible, predictable set of nearby years even for
 * a brand-new shop with no history yet, while still surfacing genuinely
 * older data if it exists. Descending, newest first.
 */
export async function getAvailableSalesYears() {
  const results = await Invoice.aggregate([
    // finalizedAt must actually exist — a handful of invoices finalized
    // before that field was introduced (Phase 4) predate it and are
    // otherwise status:'finalized' with no date. Without this, $dateToString
    // on a missing date returns null, and Number(null) silently coerces to
    // 0, producing a bogus "year 0" entry.
    { $match: { status: 'finalized', finalizedAt: { $exists: true, $ne: null } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y', date: '$finalizedAt', timezone: BUSINESS_UTC_OFFSET } },
      },
    },
  ]);

  const years = new Set(results.map((r) => Number(r._id)));
  const currentYear = getCurrentBusinessYear();
  for (let year = currentYear - YEAR_BUFFER_BACK; year <= currentYear + YEAR_BUFFER_FORWARD; year += 1) {
    years.add(year);
  }

  return Array.from(years).sort((a, b) => b - a);
}

async function getSalesTrend() {
  const dayRanges = getRecentBusinessDayRanges(TREND_DAYS);
  const rangeStart = dayRanges[0].start;
  const rangeEnd = dayRanges[dayRanges.length - 1].end;

  const results = await Invoice.aggregate([
    { $match: { status: 'finalized', finalizedAt: { $gte: rangeStart, $lt: rangeEnd } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$finalizedAt', timezone: BUSINESS_UTC_OFFSET } },
        total: { $sum: '$total' },
      },
    },
  ]);

  const totalsByDate = new Map(results.map((r) => [r._id, r.total]));

  return dayRanges.map(({ start }) => {
    const date = formatBusinessDateKey(start);
    return { date, total: totalsByDate.get(date) || 0 };
  });
}

/**
 * Sales vs. paid vs. pending, for a business day:
 *   sales   = sum(total) of every finalized invoice that day, regardless of paymentStatus
 *   pending = sum(total) where paymentStatus = 'pending'
 *   paid    = sales - pending
 * paymentStatus is a strict paid|pending enum, so every finalized invoice's
 * total lands in exactly one of those two buckets — paid is derived rather
 * than queried separately, saving a third aggregation.
 */
export async function getDashboardSummary() {
  const { start: todayStart, end: todayEnd } = getBusinessDayRangeUTC();
  const todayRangeFilter = { finalizedAt: { $gte: todayStart, $lt: todayEnd } };

  const [paymentTotals, bills, recentBills, salesTrend] = await Promise.all([
    getPaymentTotals(todayRangeFilter),
    Invoice.countDocuments({ status: 'finalized', ...todayRangeFilter }),
    Invoice.find({ status: 'finalized' })
      .sort({ finalizedAt: -1 })
      .limit(RECENT_BILLS_LIMIT)
      .select('invoiceNumber customer.name total paymentMethod paymentStatus finalizedAt'),
    getSalesTrend(),
  ]);

  const paymentBreakdown = {
    cash: paymentTotals.cash,
    upi: paymentTotals.upi,
    card: paymentTotals.card,
    credit: paymentTotals.credit,
  };
  const sales = paymentBreakdown.cash + paymentBreakdown.upi + paymentBreakdown.card + paymentBreakdown.credit;
  const pending = paymentTotals.pending;
  const paid = sales - pending;

  return {
    today: { sales, bills, paid, pending },
    paymentBreakdown,
    recentBills,
    salesTrend,
  };
}
