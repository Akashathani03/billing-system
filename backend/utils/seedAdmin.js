import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { hashPassword } from '../services/auth.service.js';
import User from '../models/User.js';

export async function seedOwnerUser() {
  const username = process.env.SEED_OWNER_USERNAME?.trim().toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD;

  if (!username || !password) {
    throw new Error('SEED_OWNER_USERNAME and SEED_OWNER_PASSWORD must be set in the environment');
  }

  const existing = await User.findOne({ username });
  if (existing) {
    console.log(`[seed] user "${username}" already exists — skipping`);
    return existing;
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({ username, passwordHash, name: 'Owner', role: 'owner' });
  console.log(`[seed] created owner user "${username}"`);
  return user;
}

async function main() {
  await connectDB();
  await seedOwnerUser();
}

const isMainModule = process.argv[1] && process.argv[1].endsWith('seedAdmin.js');

if (isMainModule) {
  main()
    .catch((err) => {
      console.error('[seed] failed:', err.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
