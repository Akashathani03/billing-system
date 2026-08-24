import Counter from '../models/Counter.js';

/**
 * Atomically allocates the next sequence number for a per-year invoice
 * counter and returns a formatted "INV-<year>-<0000>" number.
 *
 * The $inc via findOneAndUpdate is a single-document MongoDB operation,
 * which is atomic by itself — no multi-document transaction is needed for
 * uniqueness. The only race window is the very first invoice of a given
 * year: two concurrent requests can both attempt to *upsert-insert* the
 * counter document simultaneously, and MongoDB will let only one insert
 * succeed, raising a duplicate-key (11000) error on the other. That one
 * retry (now hitting an existing document) resolves it as a normal atomic
 * $inc. This is why a small retry loop is used instead of a bare call.
 */
export async function getNextInvoiceNumber(year = new Date().getFullYear()) {
  const counterId = `invoice-${year}`;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { _id: counterId },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
      );
      return `INV-${year}-${String(counter.seq).padStart(4, '0')}`;
    } catch (err) {
      const isUpsertRace = err.code === 11000;
      if (!isUpsertRace || attempt === maxAttempts) {
        throw err;
      }
    }
  }

  throw new Error('Failed to allocate invoice number after retries');
}
