import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
  },
  { timestamps: true },
);

customerSchema.index({ name: 1 });
customerSchema.index({ mobile: 1 });

export default mongoose.model('Customer', customerSchema);
