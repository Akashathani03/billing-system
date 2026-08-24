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
