import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { hashPassword } from '../services/auth.service.js';
import { shopConfigFromEnv } from '../config/businessConfig.js';
import User from '../models/User.js';
import Shop from '../models/Shop.js';

/**
 * Finds a shop by exact name, or creates it. Never renames or reconfigures
 * an existing shop — the SHOP_* env vars (address/phone/email/invoiceTerms)
 * are only ever applied at creation time, for a brand-new shop, matching
 * this script's existing "never touch existing data" rule.
 */
async function findOrCreateShop(name) {
  const existing = await Shop.findOne({ name });
  if (existing) return existing;

  const shop = await Shop.create({ name, ...shopConfigFromEnv() });
  console.log(`[seed] created shop "${name}"`);
  return shop;
}

/**
 * One user = one shop. Every run creates (or reuses) a shop by name, then
 * creates (or reuses) a user by username. Re-running with the same
 * username is always safe: an existing user's password and shop are never
 * touched — only a brand-new user gets linked to the shop this run
 * resolved. Set different SEED_OWNER_USERNAME/SEED_OWNER_PASSWORD/
 * SEED_SHOP_NAME values per run to create additional shop+owner pairs.
 */
export async function seedOwnerUser() {
  const username = process.env.SEED_OWNER_USERNAME?.trim().toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD;
  const shopName = process.env.SEED_SHOP_NAME?.trim();

  if (!username || !password || !shopName) {
    throw new Error('SEED_OWNER_USERNAME, SEED_OWNER_PASSWORD, and SEED_SHOP_NAME must be set in the environment');
  }

  const existing = await User.findOne({ username });
  if (existing) {
    console.log(`[seed] user "${username}" already exists — skipping`);
    return existing;
  }

  const shop = await findOrCreateShop(shopName);
  const passwordHash = await hashPassword(password);
  const user = await User.create({ username, passwordHash, name: 'Owner', role: 'owner', shopId: shop._id });
  console.log(`[seed] created owner user "${username}" for shop "${shopName}"`);
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
