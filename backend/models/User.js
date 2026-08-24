import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['owner', 'staff'], default: 'owner' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model('User', userSchema);
