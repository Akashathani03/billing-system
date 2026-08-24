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

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, unique: true, sparse: true },
    status: { type: String, enum: ['draft', 'finalized', 'cancelled'], default: 'draft' },

    customer: { type: customerSnapshotSchema, required: true },
    items: { type: [itemSchema], default: [] },

    subtotal: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    amountInWords: { type: String },

    paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'credit'], default: 'cash' },
    paymentStatus: { type: String, enum: ['paid', 'pending'], default: 'paid' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ 'customer.customerId': 1 });

export default mongoose.model('Invoice', invoiceSchema);
