import request from 'supertest';
import User from '../../models/User.js';
import Shop from '../../models/Shop.js';
import { hashPassword } from '../../services/auth.service.js';

/**
 * Logs in as a fresh owner user in a fresh shop by default — each call is
 * its own independent tenant, which is what most tests want without having
 * to think about it, and is exactly what the cross-tenant isolation tests
 * need (two separate calls naturally land in two different shops). Pass
 * `overrides.shopId` to instead put a second login in an ALREADY-existing
 * shop. The returned agent has `.shopId` attached, for tests that create
 * Customer/Product documents directly (bypassing the authenticated API)
 * and need the right tenant scope.
 */
export async function loginAsOwner(app, overrides = {}) {
  const username = overrides.username || 'owner';
  const password = overrides.password || 'secret123';

  const shopId = overrides.shopId || (await Shop.create({ name: overrides.shopName || `${username}'s shop` }))._id;

  const passwordHash = await hashPassword(password);
  await User.create({
    username,
    passwordHash,
    name: overrides.name || 'Owner',
    role: overrides.role || 'owner',
    shopId,
  });

  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username, password });
  agent.shopId = shopId.toString();
  return agent;
}
