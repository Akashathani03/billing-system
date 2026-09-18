import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['owner', 'staff'], default: 'owner' },
    isActive: { type: Boolean, default: true },
    // One user = one shop. Every protected route derives its data-access
    // scope from this — never from a client-supplied value — via the JWT
    // payload (see auth.service.js/signToken and auth.middleware.js).
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  },
  { timestamps: true },
);

export default mongoose.model('User', userSchema);
