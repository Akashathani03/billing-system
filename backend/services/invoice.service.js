import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import { DEFAULT_TAX_RATE } from '../config/businessConfig.js';
import { lineTotalPaise, taxAmountPaise, fromPaise } from '../utils/money.js';
import { amountToWords } from '../utils/amountInWords.js';
import { getNextInvoiceNumber } from './counter.service.js';
import { parsePagination } from '../utils/pagination.js';

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

export async function listInvoices(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;

  const [invoices, total] = await Promise.all([
    Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
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
