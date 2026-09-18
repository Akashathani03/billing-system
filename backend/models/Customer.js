import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
  },
  { timestamps: true },
);

// Leading with shopId keeps every real query (always shop-scoped) covered
// by one index instead of scanning across every shop's customers.
customerSchema.index({ shopId: 1, name: 1 });
customerSchema.index({ shopId: 1, mobile: 1 });

export default mongoose.model('Customer', customerSchema);
