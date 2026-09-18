/**
 * Client-side totals are a PREVIEW ONLY, for instant UX feedback while
 * editing. They are never sent to or trusted by the backend — the server
 * always recalculates subtotal/total from the current database product
 * prices on every save and finalize.
 */
export function calcPreviewTotals(items) {
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
  return { subtotal, total: subtotal };
}
