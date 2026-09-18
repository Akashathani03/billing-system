// Each shop's identity (name/address/phone/email/invoiceTerms) is stored on
// its own Shop document, not here — see models/Shop.js.

/**
 * Reads the SHOP_* env vars as a one-time bootstrap config for a NEW shop
 * being created by seedAdmin.js or migrateLegacyDataToShop.js. Only fields
 * actually present in the environment are included — never invented — so
 * spreading this into a Shop.create() call leaves any unset field to the
 * schema's own default (or undefined) rather than an explicit empty string.
 */
export function shopConfigFromEnv() {
  const config = {
    address: process.env.SHOP_ADDRESS,
    phone: process.env.SHOP_PHONE,
    email: process.env.SHOP_EMAIL,
    invoiceTerms: process.env.INVOICE_TERMS,
  };
  return Object.fromEntries(Object.entries(config).filter(([, value]) => value !== undefined));
}

// The shop's business day is defined in Asia/Kolkata. India has observed a
// single fixed UTC+5:30 offset with no DST since 1945, so this can safely
// be a constant instead of pulling in a timezone-database dependency — if
// the business ever needs a DST-observing timezone, this is the one place
// to change (used everywhere "today"/day-boundaries are computed).
export const BUSINESS_TIMEZONE = 'Asia/Kolkata';
export const BUSINESS_TIMEZONE_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function formatUtcOffset(offsetMs) {
  const totalMinutes = offsetMs / 60000;
  const sign = totalMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(totalMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const minutes = String(abs % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

// Same offset, formatted for MongoDB aggregation date operators (e.g.
// $dateToString's `timezone` option), derived from the one constant above
// rather than hardcoded separately.
export const BUSINESS_UTC_OFFSET = formatUtcOffset(BUSINESS_TIMEZONE_OFFSET_MS);
