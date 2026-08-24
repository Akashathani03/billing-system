import Invoice from '../models/Invoice.js';
import { getPaymentTotals } from './invoice.service.js';
import { getBusinessDayRangeUTC, getRecentBusinessDayRanges, formatBusinessDateKey } from '../utils/businessDate.js';
import { BUSINESS_UTC_OFFSET } from '../config/businessConfig.js';

const RECENT_BILLS_LIMIT = 5;
const TREND_DAYS = 7;

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
