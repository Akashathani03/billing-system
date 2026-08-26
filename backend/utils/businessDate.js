import { BUSINESS_TIMEZONE_OFFSET_MS } from '../config/businessConfig.js';

/**
 * The UTC [start, end) instants for the business day (Asia/Kolkata)
 * containing `referenceDate`. Works by shifting the instant into "IST
 * wall-clock time expressed as a UTC timestamp", truncating to that day's
 * midnight using UTC getters (safe because we already shifted), then
 * shifting back — this correctly finds IST midnight regardless of the
 * server's own local timezone.
 */
export function getBusinessDayRangeUTC(referenceDate = new Date()) {
  const shifted = new Date(referenceDate.getTime() + BUSINESS_TIMEZONE_OFFSET_MS);
  const startOfShiftedDayMs = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  const start = new Date(startOfShiftedDayMs - BUSINESS_TIMEZONE_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** The last `days` business-day ranges (Asia/Kolkata), oldest first, ending with today. */
export function getRecentBusinessDayRanges(days, referenceDate = new Date()) {
  const { start: todayStart } = getBusinessDayRangeUTC(referenceDate);
  const ranges = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const start = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    ranges.push({ start, end });
  }
  return ranges;
}

/** The Asia/Kolkata calendar date (YYYY-MM-DD) that `date` falls on. */
export function formatBusinessDateKey(date) {
  const shifted = new Date(date.getTime() + BUSINESS_TIMEZONE_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * The last `months` business-month ranges (Asia/Kolkata), oldest first,
 * ending with the month containing `referenceDate`. Same shift-truncate-
 * shift-back technique as the day ranges, just truncating to the 1st of
 * the month instead of the day — Date.UTC correctly rolls negative month
 * indices back across year boundaries, so no separate year-rollover logic
 * is needed.
 */
export function getRecentBusinessMonthRanges(months, referenceDate = new Date()) {
  const shifted = new Date(referenceDate.getTime() + BUSINESS_TIMEZONE_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();

  const ranges = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const startOfShiftedMonthMs = Date.UTC(year, month - i, 1);
    const endOfShiftedMonthMs = Date.UTC(year, month - i + 1, 1);
    ranges.push({
      start: new Date(startOfShiftedMonthMs - BUSINESS_TIMEZONE_OFFSET_MS),
      end: new Date(endOfShiftedMonthMs - BUSINESS_TIMEZONE_OFFSET_MS),
    });
  }
  return ranges;
}

/** The Asia/Kolkata year-month (YYYY-MM) that `date` falls on. */
export function formatBusinessMonthKey(date) {
  const shifted = new Date(date.getTime() + BUSINESS_TIMEZONE_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * The 12 business-month ranges (Asia/Kolkata) for a FIXED calendar year —
 * January through December of `year`, regardless of `referenceDate`. Unlike
 * getRecentBusinessMonthRanges (a rolling window relative to "now"), this
 * always returns exactly those 12 months, including future ones if `year`
 * is the current year — the caller decides what "no data yet" means for
 * those.
 */
export function getBusinessYearMonthRanges(year) {
  const ranges = [];
  for (let month = 0; month < 12; month += 1) {
    const startMs = Date.UTC(year, month, 1);
    const endMs = Date.UTC(year, month + 1, 1);
    ranges.push({
      start: new Date(startMs - BUSINESS_TIMEZONE_OFFSET_MS),
      end: new Date(endMs - BUSINESS_TIMEZONE_OFFSET_MS),
      monthNumber: month + 1,
    });
  }
  return ranges;
}

/** The current year in the business timezone (Asia/Kolkata), not the server's local time. */
export function getCurrentBusinessYear(referenceDate = new Date()) {
  return Number(formatBusinessMonthKey(referenceDate).slice(0, 4));
}
