/**
 * Small, shared argument validators for every AI tool's `validate()` step.
 * Extracted out of tools/index.js so tools/reportTools.js can reuse the same
 * validation (and the same date-range convention) without importing back
 * from index.js, which would be a circular import (index.js is the one that
 * imports reportTools.js to add it to the allowlist).
 */

/** Thrown for a bad/unknown tool name or malformed arguments — the message is always safe to show Gemini/the user, never an internal detail. */
export class ToolValidationError extends Error {}

function isValidDateString(value) {
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(new Date(value).getTime());
}

export function assertOptionalDate(value, fieldName) {
  if (value === undefined || value === null) return undefined;
  if (!isValidDateString(value)) {
    throw new ToolValidationError(`"${fieldName}" must be a valid date (e.g. 2026-08-01)`);
  }
  return value;
}

export function assertOptionalInt(value, fieldName, { min, max }) {
  if (value === undefined || value === null) return undefined;
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new ToolValidationError(`"${fieldName}" must be a whole number between ${min} and ${max}`);
  }
  return num;
}

export function assertOptionalEnum(value, fieldName, allowed) {
  if (value === undefined || value === null) return undefined;
  if (!allowed.includes(value)) {
    throw new ToolValidationError(`"${fieldName}" must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

export function assertOptionalString(value, fieldName, { maxLength }) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new ToolValidationError(`"${fieldName}" must be a short piece of text`);
  }
  return value;
}

/**
 * `getPaymentTotals`'s `filter` param expects a ready Mongo-style
 * {finalizedAt: {$gte, $lt}} shape (see dashboard.service.js's own callers)
 * — this reuses the exact dateFrom/dateTo -> finalizedAt convention already
 * established in invoice.service.js's buildInvoiceListFilter, rather than
 * inventing a second one.
 */
export function buildDateRangeFilter({ dateFrom, dateTo } = {}) {
  if (!dateFrom && !dateTo) return {};
  const finalizedAt = {};
  if (dateFrom) finalizedAt.$gte = new Date(dateFrom);
  if (dateTo) finalizedAt.$lt = new Date(new Date(dateTo).getTime() + 24 * 60 * 60 * 1000);
  return { finalizedAt };
}
