import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

productSchema.index({ shopId: 1, name: 1 });
productSchema.index({ shopId: 1, isActive: 1, name: 1 });

export default mongoose.model('Product', productSchema);
