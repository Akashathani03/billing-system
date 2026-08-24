import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_TAX_RATE = parseFloat(process.env.TAX_RATE ?? '0.18');

// Single source of shop identity for invoice output (PDF, print). Only
// fields actually present in the environment are populated — nothing here
// is invented, and consumers must treat any of these as possibly undefined.
// SHOP_LOGO_PATH is relative to the backend/ project root.
export const SHOP_CONFIG = {
  name: process.env.SHOP_NAME,
  address: process.env.SHOP_ADDRESS,
  phone: process.env.SHOP_PHONE,
  gst: process.env.SHOP_GST,
  email: process.env.SHOP_EMAIL,
  logoPath: process.env.SHOP_LOGO_PATH ? path.resolve(__dirname, '..', process.env.SHOP_LOGO_PATH) : undefined,
  invoiceTerms: process.env.INVOICE_TERMS,
};

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
