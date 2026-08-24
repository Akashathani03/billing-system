/**
 * Client-side totals are a PREVIEW ONLY, for instant UX feedback while
 * editing. They are never sent to or trusted by the backend — the server
 * always recalculates subtotal/tax/total from the current database product
 * prices on every save and finalize.
 */
const PREVIEW_TAX_RATE = 0.18;

export function calcPreviewTotals(items) {
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
  const taxAmount = Math.round(subtotal * PREVIEW_TAX_RATE * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;
  return { subtotal, taxAmount, total, taxRate: PREVIEW_TAX_RATE };
}
