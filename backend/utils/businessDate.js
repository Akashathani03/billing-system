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
