import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { shopConfigFromEnv } from '../config/businessConfig.js';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import Invoice from '../models/Invoice.js';
import ManualBillPhoto from '../models/ManualBillPhoto.js';

/**
 * One-time backfill for data created before the multi-shop conversion:
 * links an existing user to a shop (without touching their password) and
 * assigns that shop to every pre-existing Customer/Product/Invoice/
 * ManualBillPhoto document that has no shopId yet.
 *
 * Safe to re-run: only ever touches documents matching
 * {shopId: {$exists: false}}, so a second run is a no-op. Never deletes
 * anything, never reassigns a user or document that already has a shopId.
 *
 * This is deliberately separate from seedAdmin.js — seedAdmin only ever
 * creates brand-new users (and never modifies an existing one, to avoid any
 * risk of touching a real password), while this script's whole purpose is
 * to modify an EXISTING user's shopId plus backfill old data. Keeping them
 * apart means seedAdmin can never accidentally backfill unrelated legacy
 * data into a freshly created shop.
 */
export async function migrateLegacyDataToShop() {
  const username = process.env.MIGRATE_TO_USERNAME?.trim().toLowerCase();
  const shopName = process.env.MIGRATE_TO_SHOP_NAME?.trim();

  if (!username || !shopName) {
    throw new Error('MIGRATE_TO_USERNAME and MIGRATE_TO_SHOP_NAME must be set in the environment');
  }

  const user = await User.findOne({ username });
  if (!user) {
    throw new Error(`No user found with username "${username}" — nothing to migrate`);
  }

  let shop = await Shop.findOne({ name: shopName });
  if (!shop) {
    // Business identity (address/phone/email/invoiceTerms) is populated
    // from the SHOP_* env vars only at creation time, so the migrated
    // shop's invoices/PDFs carry the same identity as before the
    // multi-shop conversion. Re-running this script never touches an
    // already-created shop's config, same as it never re-touches the user.
    shop = await Shop.create({ name: shopName, ...shopConfigFromEnv() });
    console.log(`[migrate] created shop "${shopName}"`);
  }

  if (user.shopId) {
    console.log(`[migrate] user "${username}" already has a shop — leaving as-is`);
  } else {
    await User.findByIdAndUpdate(user._id, { shopId: shop._id });
    console.log(`[migrate] linked user "${username}" to shop "${shopName}"`);
  }

  const models = { Customer, Product, Invoice, ManualBillPhoto };
  for (const [label, Model] of Object.entries(models)) {
    const result = await Model.updateMany({ shopId: { $exists: false } }, { $set: { shopId: shop._id } });
    console.log(`[migrate] ${label}: backfilled ${result.modifiedCount} document(s)`);
  }
}

async function main() {
  await connectDB();
  await migrateLegacyDataToShop();
}

const isMainModule = process.argv[1] && process.argv[1].endsWith('migrateLegacyDataToShop.js');

if (isMainModule) {
  main()
    .catch((err) => {
      console.error('[migrate] failed:', err.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
