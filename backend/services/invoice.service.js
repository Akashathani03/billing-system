import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import { lineTotalPaise, fromPaise } from '../utils/money.js';
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

async function buildCustomerSnapshot(customerId, shopId) {
  const customer = await Customer.findOne({ _id: customerId, shopId });
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

async function computeInvoiceFinancials(items, shopId, { allowEmpty, requireActiveProducts = false } = {}) {
  if (!items || items.length === 0) {
    if (allowEmpty) {
      return { items: [], subtotal: 0, total: 0, amountInWords: amountToWords(0) };
    }
    throw new InvoiceError('Invoice must have at least one item', 'EMPTY_INVOICE', 400);
  }

  const productIds = items.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds }, shopId });
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

  const total = fromPaise(subtotalPaise);

  return {
    items: builtItems,
    subtotal: total,
    total,
    amountInWords: amountToWords(total),
  };
}

export async function createDraftInvoice({
  customerId,
  items,
  paymentMethod,
  paymentStatus,
  createdBy,
  shopId,
}) {
  const customer = await buildCustomerSnapshot(customerId, shopId);
  const financials = await computeInvoiceFinancials(items, shopId, { allowEmpty: true });

  return Invoice.create({
    shopId,
    status: 'draft',
    customer,
    ...financials,
    paymentMethod: paymentMethod || 'cash',
    paymentStatus: paymentStatus || 'paid',
    createdBy,
  });
}

export async function getInvoiceById(id, shopId) {
  return Invoice.findOne({ _id: id, shopId });
}

function buildInvoiceListFilter(query, shopId) {
  const filter = { shopId };

  if (query.status) filter.status = query.status;
  if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;

  if (query.dateFrom || query.dateTo) {
    filter.finalizedAt = {};

    if (query.dateFrom) {
      filter.finalizedAt.$gte = new Date(query.dateFrom);
    }

    if (query.dateTo) {
      filter.finalizedAt.$lt = new Date(
        new Date(query.dateTo).getTime() + 24 * 60 * 60 * 1000,
      );
    }
  }

  if (query.search?.trim()) {
    const regex = buildSearchRegex(query.search);

    filter.$or = [
      { invoiceNumber: regex },
      { 'customer.name': regex },
      { 'customer.mobile': regex },
    ];
  }

  return filter;
}

export async function listInvoices(query, shopId) {
  const { page, limit, skip } = parsePagination(query);
  const filter = buildInvoiceListFilter(query, shopId);

  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .sort({ finalizedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Invoice.countDocuments(filter),
  ]);

  return { invoices, total, page, limit };
}

export async function updateDraftInvoice(
  id,
  { customerId, items, paymentMethod, paymentStatus },
  shopId,
) {
  const invoice = await Invoice.findOne({ _id: id, shopId });

  if (!invoice) return null;

  if (invoice.status !== 'draft') {
    throw new InvoiceError(
      'Only draft invoices can be edited',
      'INVALID_STATE',
      409,
    );
  }

  if (customerId) {
    invoice.customer = await buildCustomerSnapshot(customerId, shopId);
  }

  if (items !== undefined) {
    const financials = await computeInvoiceFinancials(items, shopId, {
      allowEmpty: true,
    });

    invoice.items = financials.items;
    invoice.subtotal = financials.subtotal;
    invoice.total = financials.total;
    invoice.amountInWords = financials.amountInWords;
  }

  if (paymentMethod) invoice.paymentMethod = paymentMethod;
  if (paymentStatus) invoice.paymentStatus = paymentStatus;

  await invoice.save();

  return invoice;
}

export async function deleteDraftInvoice(id, shopId) {
  const invoice = await Invoice.findOne({ _id: id, shopId });

  if (!invoice) return null;

  if (invoice.status !== 'draft') {
    throw new InvoiceError(
      'Only draft invoices can be deleted',
      'INVALID_STATE',
      409,
    );
  }

  await Invoice.findByIdAndDelete(id);

  return invoice;
}

export async function finalizeInvoice(id, shopId) {
  const invoice = await Invoice.findOne({ _id: id, shopId });

  if (!invoice) return null;

  if (invoice.status !== 'draft') {
    throw new InvoiceError(
      'Invoice is not a draft and cannot be finalized',
      'INVALID_STATE',
      409,
    );
  }

  const customer = await buildCustomerSnapshot(
    invoice.customer.customerId,
    shopId,
  );

  const financials = await computeInvoiceFinancials(
    invoice.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
    shopId,
    {
      allowEmpty: false,
      requireActiveProducts: true,
    },
  );

  const invoiceNumber = await getNextInvoiceNumber(shopId);

  const finalized = await Invoice.findOneAndUpdate(
    {
      _id: id,
      shopId,
      status: 'draft',
    },
    {
      $set: {
        status: 'finalized',
        invoiceNumber,
        finalizedAt: new Date(),
        customer,
        items: financials.items,
        subtotal: financials.subtotal,
        total: financials.total,
        amountInWords: financials.amountInWords,
      },
    },
    {
      returnDocument: 'after',
    },
  );

  if (!finalized) {
    throw new InvoiceError(
      'Invoice was already finalized or modified by another request',
      'CONFLICT',
      409,
    );
  }

  return finalized;
}

export async function updatePaymentStatus(
  id,
  { newStatus, changedBy },
  shopId,
) {
  const invoice = await Invoice.findOne({ _id: id, shopId });

  if (!invoice) return null;

  if (invoice.status !== 'finalized') {
    throw new InvoiceError(
      'Only finalized invoices have a payment status to update',
      'INVALID_STATE',
      409,
    );
  }

  if (invoice.paymentStatus !== 'pending' || newStatus !== 'paid') {
    throw new InvoiceError(
      'Payment status can only move from pending to paid',
      'INVALID_TRANSITION',
      409,
    );
  }

  const updated = await Invoice.findOneAndUpdate(
    {
      _id: id,
      shopId,
      status: 'finalized',
      paymentStatus: 'pending',
    },
    {
      $set: {
        paymentStatus: 'paid',
      },
      $push: {
        paymentHistory: {
          previousStatus: 'pending',
          newStatus: 'paid',
          changedBy,
          changedAt: new Date(),
        },
      },
    },
    {
      returnDocument: 'after',
    },
  );

  if (!updated) {
    throw new InvoiceError(
      'Payment status was already updated by another request',
      'CONFLICT',
      409,
    );
  }

  return updated;
}

export async function getInvoicesByCustomer(customerId, query, shopId) {
  const { page, limit, skip } = parsePagination(query);

  const filter = {
    shopId: new mongoose.Types.ObjectId(shopId),
    'customer.customerId': new mongoose.Types.ObjectId(customerId),
    status: 'finalized',
  };

  const [invoices, totalBills, totalsAgg] = await Promise.all([
    Invoice.find(filter)
      .sort({ finalizedAt: -1 })
      .skip(skip)
      .limit(limit),

    Invoice.countDocuments(filter),

    Invoice.aggregate([
      {
        $match: filter,
      },
      {
        $group: {
          _id: null,
          totalPurchaseValue: {
            $sum: '$total',
          },
        },
      },
    ]),
  ]);

  return {
    invoices,
    totalBills,
    totalPurchaseValue: totalsAgg[0]?.totalPurchaseValue || 0,
    page,
    limit,
  };
}

export async function getPaymentTotals(filter = {}, shopId) {
  const baseFilter = {
    ...filter,
    shopId: new mongoose.Types.ObjectId(shopId),
    status: 'finalized',
  };

  const [byMethod, pendingAgg] = await Promise.all([
    Invoice.aggregate([
      {
        $match: baseFilter,
      },
      {
        $group: {
          _id: '$paymentMethod',
          total: {
            $sum: '$total',
          },
        },
      },
    ]),

    Invoice.aggregate([
      {
        $match: {
          ...baseFilter,
          paymentStatus: 'pending',
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: '$total',
          },
        },
      },
    ]),
  ]);

  const totals = {
    cash: 0,
    upi: 0,
    card: 0,
    credit: 0,
  };

  byMethod.forEach((row) => {
    totals[row._id] = row.total;
  });

  return {
    ...totals,
    pending: pendingAgg[0]?.total || 0,
  };
}

export async function getTopProducts(
  shopId,
  { limit = 10, dateFrom, dateTo } = {},
) {
  const shopObjectId = new mongoose.Types.ObjectId(shopId);

  const match = {
    shopId: shopObjectId,
    status: 'finalized',
  };

  if (dateFrom || dateTo) {
    match.finalizedAt = {};

    if (dateFrom) {
      match.finalizedAt.$gte = new Date(dateFrom);
    }

    if (dateTo) {
      match.finalizedAt.$lt = new Date(dateTo);
    }
  }

  return Invoice.aggregate([
    {
      $match: match,
    },

    {
      $unwind: '$items',
    },

    {
      $group: {
        _id: '$items.productId',
        productName: {
          $first: '$items.name',
        },
        unit: {
          $first: '$items.unit',
        },
        totalQuantity: {
          $sum: '$items.quantity',
        },
        totalSales: {
          $sum: '$items.lineTotal',
        },
        timesSold: {
          $sum: 1,
        },
      },
    },

    {
      $sort: {
        totalQuantity: -1,
      },
    },

    {
      $limit: Math.min(
        Math.max(Number(limit) || 10, 1),
        50,
      ),
    },

    {
      $project: {
        _id: 0,
        productId: '$_id',
        productName: 1,
        unit: 1,
        totalQuantity: 1,
        totalSales: 1,
        timesSold: 1,
      },
    },
  ]);
}
export async function getCustomersWithOutstandingBalance(shopId) {
  const shopObjectId = new mongoose.Types.ObjectId(shopId);

  return Customer.aggregate([
    {
      $match: {
        shopId: shopObjectId,
      },
    },
    {
      $lookup: {
        from: 'invoices',
        let: { customerId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  // Invoice has no top-level customerId — the reference is
                  // nested in the customer snapshot (see models/Invoice.js).
                  { $eq: ['$customer.customerId', '$$customerId'] },
                  { $eq: ['$shopId', shopObjectId] },
                  { $eq: ['$status', 'finalized'] },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: '$total' },
              // Invoice has no partial-payment field — paymentStatus is a
              // binary paid/pending applied to the whole `total`, same
              // definition getPaymentTotals() already uses for "pending".
              paidAmount: {
                $sum: {
                  $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$total', 0],
                },
              },
            },
          },
        ],
        as: 'invoiceTotals',
      },
    },
    {
      $set: {
        totalAmount: {
          $ifNull: [{ $arrayElemAt: ['$invoiceTotals.totalAmount', 0] }, 0],
        },
        paidAmount: {
          $ifNull: [{ $arrayElemAt: ['$invoiceTotals.paidAmount', 0] }, 0],
        },
      },
    },
    {
      $set: {
        outstandingAmount: {
          $subtract: ['$totalAmount', '$paidAmount'],
        },
      },
    },
    {
      $match: {
        outstandingAmount: { $gt: 0 },
      },
    },
    {
      $project: {
        _id: 0,
        customerId: '$_id',
        name: 1,
        mobile: 1,
        totalAmount: 1,
        paidAmount: 1,
        outstandingAmount: 1,
      },
    },
    {
      $sort: {
        outstandingAmount: -1,
      },
    },
  ]);
}
