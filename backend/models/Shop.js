import mongoose from 'mongoose';

const shopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Identity shown on this shop's invoices/PDFs. All optional except
    // name — pdf.service.js already tolerates any of these being absent.
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    invoiceTerms: { type: String, trim: true },
  },
  { timestamps: true },
);

export default mongoose.model('Shop', shopSchema);
