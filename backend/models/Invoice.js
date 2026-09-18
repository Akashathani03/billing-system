import mongoose from 'mongoose';

const customerSnapshotSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    address: { type: String },
  },
  { _id: false },
);

const itemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  unit: { type: String },
  quantity: { type: Number, required: true, min: 0.001 },
  lineTotal: { type: Number, required: true, min: 0 },
});

const paymentHistorySchema = new mongoose.Schema(
  {
    previousStatus: { type: String, enum: ['paid', 'pending'], required: true },
    newStatus: { type: String, enum: ['paid', 'pending'], required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, required: true },
  },
  { _id: false },
);

const invoiceSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    // Not globally unique any more — invoice numbers are per-shop sequential
    // (see counter.service.js), so uniqueness is enforced on {shopId,
    // invoiceNumber} below instead of on invoiceNumber alone. No `sparse`
    // here: the index below is a PARTIAL index instead (see comment there),
    // so this field needs no index option of its own.
    invoiceNumber: { type: String },
    status: { type: String, enum: ['draft', 'finalized', 'cancelled'], default: 'draft' },
    // Set only at finalization — this is the date a draft actually became a
    // real bill, which is what billing-history sorting/date-filtering and
    // "Today"/"Yesterday" grouping should reflect, not when the draft was
    // first started (createdAt) nor when it was last touched (updatedAt,
    // which also moves on every later payment-status change).
    finalizedAt: { type: Date },

    customer: { type: customerSnapshotSchema, required: true },
    items: { type: [itemSchema], default: [] },

    subtotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    amountInWords: { type: String },

    paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'credit'], default: 'cash' },
    paymentStatus: { type: String, enum: ['paid', 'pending'], default: 'paid' },
    paymentHistory: { type: [paymentHistorySchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// Primary billing-history query is {status:'finalized', ...filters} sorted
// by finalizedAt desc — this compound index serves both the equality filter
// and the sort in one index scan, and its prefix (status alone) already
// covers the Drafts page's {status:'draft'} filter, so a standalone status
// index would be redundant.
// A plain `sparse` compound index only excludes a document when EVERY
// indexed field is missing — since shopId is always present, a `sparse`
// {shopId, invoiceNumber} index would still index every draft (invoiceNumber
// absent) as invoiceNumber:null, and a second draft in the same shop would
// collide on that null. A PARTIAL index avoids this: it only includes
// documents matching the filter expression at all, so drafts (where
// invoiceNumber truly doesn't exist on the document) are excluded outright,
// while finalized invoices (which always get a real invoiceNumber at
// finalization) are still enforced unique per shop.
invoiceSchema.index(
  { shopId: 1, invoiceNumber: 1 },
  { unique: true, partialFilterExpression: { invoiceNumber: { $exists: true } } },
);
invoiceSchema.index({ shopId: 1, status: 1, finalizedAt: -1 });
invoiceSchema.index({ shopId: 1, createdAt: -1 });
invoiceSchema.index({ shopId: 1, paymentStatus: 1 });
invoiceSchema.index({ shopId: 1, paymentMethod: 1 });
invoiceSchema.index({ shopId: 1, 'customer.customerId': 1 });

export default mongoose.model('Invoice', invoiceSchema);
