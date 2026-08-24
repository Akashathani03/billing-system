import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import { DEFAULT_TAX_RATE } from '../config/businessConfig.js';
import { lineTotalPaise, taxAmountPaise, fromPaise } from '../utils/money.js';
import { amountToWords } from '../utils/amountInWords.js';
import { getNextInvoiceNumber } from './counter.service.js';
import { parsePagination, buildSearchRegex } from '../utils/pagination.js';

export class InvoiceError extends Error {
  constructor(message, code = 'VALIDATION_ERROR', status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.expose = true;
  }
}

async function buildCustomerSnapshot(customerId) {
  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new InvoiceError('Customer not found', 'INVALID_CUSTOMER', 400);
  }
  return {
    customerId: customer._id,
    name: customer.name,
    mobile: customer.mobile,
    address: customer.address,
  };
}

/**
 * Recomputes items, subtotal, tax, total, and amount-in-words from scratch,
 * always using the CURRENT product price from the database — never a
 * client-supplied price. This is the single source of truth for invoice
 * money, used identically by draft create/update and by finalization, so
 * there is exactly one calculation code path to trust.
 */
async function computeInvoiceFinancials(items, { allowEmpty, requireActiveProducts = false } = {}) {
  if (!items || items.length === 0) {
    if (allowEmpty) {
      return { items: [], subtotal: 0, taxRate: DEFAULT_TAX_RATE, taxAmount: 0, total: 0, amountInWords: amountToWords(0) };
    }
    throw new InvoiceError('Invoice must have at least one item', 'EMPTY_INVOICE', 400);
  }

  const productIds = items.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  let subtotalPaise = 0;
  const builtItems = items.map((item) => {
    const product = productMap.get(String(item.productId));
    if (!product) {
      throw new InvoiceError(`Product ${item.productId} not found`, 'INVALID_PRODUCT', 400);
    }
    if (requireActiveProducts && !product.isActive) {
      throw new InvoiceError(`Product "${product.name}" is no longer active`, 'INACTIVE_PRODUCT', 400);
    }

    const linePaise = lineTotalPaise(product.price, item.quantity);
    subtotalPaise += linePaise;

    return {
      productId: product._id,
      name: product.name,
      price: product.price,
      unit: product.unit,
      quantity: item.quantity,
      lineTotal: fromPaise(linePaise),
    };
  });

  const taxRate = DEFAULT_TAX_RATE;
  const taxPaise = taxAmountPaise(subtotalPaise, taxRate);
  const totalPaise = subtotalPaise + taxPaise;
  const total = fromPaise(totalPaise);

  return {
    items: builtItems,
    subtotal: fromPaise(subtotalPaise),
    taxRate,
    taxAmount: fromPaise(taxPaise),
    total,
    amountInWords: amountToWords(total),
  };
}

export async function createDraftInvoice({ customerId, items, paymentMethod, paymentStatus, createdBy }) {
  const customer = await buildCustomerSnapshot(customerId);
  const financials = await computeInvoiceFinancials(items, { allowEmpty: true });

  return Invoice.create({
    status: 'draft',
    customer,
    ...financials,
    paymentMethod: paymentMethod || 'cash',
    paymentStatus: paymentStatus || 'paid',
    createdBy,
  });
}

export async function getInvoiceById(id) {
  return Invoice.findById(id);
}

/** Shared filter-building for GET /api/invoices and the customer-history endpoint. */
function buildInvoiceListFilter(query) {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;

  if (query.dateFrom || query.dateTo) {
    filter.finalizedAt = {};
    // Date-only strings (YYYY-MM-DD) parse as UTC midnight. For the upper
    // bound, add exactly 24h in UTC and use an exclusive `$lt` rather than
    // `setHours(23,59,59,999)`, which mutates in the SERVER's local
    // timezone and would shift the cutoff by its UTC offset — silently
    // wrong on any server not running in UTC.
    if (query.dateFrom) filter.finalizedAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      filter.finalizedAt.$lt = new Date(new Date(query.dateTo).getTime() + 24 * 60 * 60 * 1000);
    }
  }

  if (query.search?.trim()) {
    const regex = buildSearchRegex(query.search);
    filter.$or = [{ invoiceNumber: regex }, { 'customer.name': regex }, { 'customer.mobile': regex }];
  }

  return filter;
}

export async function listInvoices(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = buildInvoiceListFilter(query);

  const [invoices, total] = await Promise.all([
    Invoice.find(filter).sort({ finalizedAt: -1, createdAt: -1 }).skip(skip).limit(limit),
    Invoice.countDocuments(filter),
  ]);

  return { invoices, total, page, limit };
}

export async function updateDraftInvoice(id, { customerId, items, paymentMethod, paymentStatus }) {
  const invoice = await Invoice.findById(id);
  if (!invoice) return null;

  if (invoice.status !== 'draft') {
    throw new InvoiceError('Only draft invoices can be edited', 'INVALID_STATE', 409);
  }

  if (customerId) {
    invoice.customer = await buildCustomerSnapshot(customerId);
  }

  if (items !== undefined) {
    const financials = await computeInvoiceFinancials(items, { allowEmpty: true });
    invoice.items = financials.items;
    invoice.subtotal = financials.subtotal;
    invoice.taxRate = financials.taxRate;
    invoice.taxAmount = financials.taxAmount;
    invoice.total = financials.total;
    invoice.amountInWords = financials.amountInWords;
  }

  if (paymentMethod) invoice.paymentMethod = paymentMethod;
  if (paymentStatus) invoice.paymentStatus = paymentStatus;

  await invoice.save();
  return invoice;
}

/**
 * Discards a draft outright. Unlike finalized invoices — which are never
 * hard-deleted, per the immutability guarantee — a draft was never an
 * actual sale, so there's no historical record to preserve; the owner
 * should be able to throw away a bill they started and don't want. Only
 * ever allowed while status is still 'draft'.
 */
export async function deleteDraftInvoice(id) {
  const invoice = await Invoice.findById(id);
  if (!invoice) return null;

  if (invoice.status !== 'draft') {
    throw new InvoiceError('Only draft invoices can be deleted', 'INVALID_STATE', 409);
  }

  await Invoice.findByIdAndDelete(id);
  return invoice;
}

/**
 * Finalizes a draft: re-derives the customer snapshot and every item's
 * price fresh from the database (ignoring whatever was cached on the
 * draft), allocates a permanent sequential invoice number, and atomically
 * flips status to "finalized" only if the invoice is *still* a draft at
 * that instant. The status-guarded conditional update is what prevents two
 * concurrent finalize calls on the same invoice from both succeeding — the
 * second one's filter simply won't match and it gets a 409 instead of a
 * silently duplicated finalize.
 */
export async function finalizeInvoice(id) {
  const invoice = await Invoice.findById(id);
  if (!invoice) return null;

  if (invoice.status !== 'draft') {
    throw new InvoiceError('Invoice is not a draft and cannot be finalized', 'INVALID_STATE', 409);
  }

  const customer = await buildCustomerSnapshot(invoice.customer.customerId);
  const financials = await computeInvoiceFinancials(
    invoice.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    { allowEmpty: false, requireActiveProducts: true },
  );

  const invoiceNumber = await getNextInvoiceNumber();

  const finalized = await Invoice.findOneAndUpdate(
    { _id: id, status: 'draft' },
    {
      $set: {
        status: 'finalized',
        invoiceNumber,
        finalizedAt: new Date(),
        customer,
        items: financials.items,
        subtotal: financials.subtotal,
        taxRate: financials.taxRate,
        taxAmount: financials.taxAmount,
        total: financials.total,
        amountInWords: financials.amountInWords,
      },
    },
    { returnDocument: 'after' },
  );

  if (!finalized) {
    throw new InvoiceError('Invoice was already finalized or modified by another request', 'CONFLICT', 409);
  }

  return finalized;
}

/**
 * Moves paymentStatus pending -> paid and records an audit entry. This is
 * the ONLY mutation allowed on a finalized invoice — invoiceNumber,
 * customer, items, and all money fields are untouched (the $set below
 * literally cannot reach them). The MVP only supports one-directional
 * pending -> paid; any other requested transition (including paid -> paid,
 * a no-op re-request) is rejected rather than silently accepted, so a
 * "Mark as Paid" tap can never be ambiguous about what it did.
 *
 * Race safety mirrors finalizeInvoice: the atomic update's filter re-checks
 * paymentStatus:'pending' at write time, so if two requests race, only the
 * one that's still looking at a genuinely-pending invoice succeeds — the
 * loser's filter won't match and it gets CONFLICT instead of a second
 * audit entry for the same transition.
 */
export async function updatePaymentStatus(id, { newStatus, changedBy }) {
  const invoice = await Invoice.findById(id);
  if (!invoice) return null;

  if (invoice.status !== 'finalized') {
    throw new InvoiceError('Only finalized invoices have a payment status to update', 'INVALID_STATE', 409);
  }

  if (invoice.paymentStatus !== 'pending' || newStatus !== 'paid') {
    throw new InvoiceError('Payment status can only move from pending to paid', 'INVALID_TRANSITION', 409);
  }

  const updated = await Invoice.findOneAndUpdate(
    { _id: id, status: 'finalized', paymentStatus: 'pending' },
    {
      $set: { paymentStatus: 'paid' },
      $push: {
        paymentHistory: { previousStatus: 'pending', newStatus: 'paid', changedBy, changedAt: new Date() },
      },
    },
    { returnDocument: 'after' },
  );

  if (!updated) {
    throw new InvoiceError('Payment status was already updated by another request', 'CONFLICT', 409);
  }

  return updated;
}

/**
 * A customer's finalized billing history plus aggregate totals. Cancelled
 * invoices are excluded entirely (not just from the totals) — a cancelled
 * invoice never represents a real completed sale for this customer, so it
 * shouldn't appear in "their bills" any more than a draft would. Drafts are
 * excluded for the same reason: nothing was ever actually billed.
 */
export async function getInvoicesByCustomer(customerId, query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { 'customer.customerId': new mongoose.Types.ObjectId(customerId), status: 'finalized' };

  const [invoices, totalBills, totalsAgg] = await Promise.all([
    Invoice.find(filter).sort({ finalizedAt: -1 }).skip(skip).limit(limit),
    Invoice.countDocuments(filter),
    Invoice.aggregate([{ $match: filter }, { $group: { _id: null, totalPurchaseValue: { $sum: '$total' } } }]),
  ]);

  return {
    invoices,
    totalBills,
    totalPurchaseValue: totalsAgg[0]?.totalPurchaseValue || 0,
    page,
    limit,
  };
}

/**
 * Sums finalized-invoice totals by payment method, plus the pending total,
 * over an optional base filter (e.g. a date range). Not wired to any route
 * yet — Phase 5's dashboard is the intended caller — but written now so
 * that work reuses this instead of duplicating the aggregation. `filter`
 * must already contain real ObjectId instances for any id fields (this
 * runs through aggregate(), which — unlike find()/countDocuments() — does
 * not auto-cast query values).
 */
export async function getPaymentTotals(filter = {}) {
  const baseFilter = { ...filter, status: 'finalized' };

  const [byMethod, pendingAgg] = await Promise.all([
    Invoice.aggregate([{ $match: baseFilter }, { $group: { _id: '$paymentMethod', total: { $sum: '$total' } } }]),
    Invoice.aggregate([
      { $match: { ...baseFilter, paymentStatus: 'pending' } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
  ]);

  const totals = { cash: 0, upi: 0, card: 0, credit: 0 };
  byMethod.forEach((row) => {
    totals[row._id] = row.total;
  });

  return { ...totals, pending: pendingAgg[0]?.total || 0 };
}
