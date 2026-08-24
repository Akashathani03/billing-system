/**
 * Money is computed in integer paise internally so that summing many line
 * items never accumulates binary floating-point drift (e.g. 100.01 becoming
 * 100.009999...). Values are only converted back to rupee decimals once, at
 * the end, for storage/display. Rounding is round-half-up (Math.round),
 * matching standard commercial/GST rounding conventions.
 */

export function toPaise(rupees) {
  return Math.round(rupees * 100);
}

export function fromPaise(paise) {
  return paise / 100;
}

export function lineTotalPaise(priceRupees, quantity) {
  return Math.round(toPaise(priceRupees) * quantity);
}

export function taxAmountPaise(subtotalPaise, taxRate) {
  return Math.round(subtotalPaise * taxRate);
}

/**
 * Formats a STORED rupee amount for display, e.g. 1250.5 -> "₹1,250.50",
 * using Indian digit grouping (lakh/crore, not Western thousands). Never
 * used for calculation — only ever applied to an already-final number.
 */
export function formatINR(amount) {
  return amount.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
