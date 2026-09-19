import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import { hashPassword, verifyPassword } from '../services/auth.service.js';
import { seedOwnerUser } from '../utils/seedAdmin.js';

let mongod;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '7d';
  process.env.COOKIE_NAME = 'billing_session';

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await User.deleteMany({});
});

async function createOwner(username = 'owner', password = 'secret123') {
  const passwordHash = await hashPassword(password);
  const shop = await Shop.create({ name: `${username}'s shop` });
  return User.create({ username, passwordHash, name: 'Owner', role: 'owner', shopId: shop._id });
}

describe('POST /api/auth/login', () => {
  test('succeeds with correct credentials and sets an httpOnly cookie', async () => {
    await createOwner('owner', 'secret123');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'owner', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: 'owner', name: 'Owner', role: 'owner' });
    expect(res.body.user.passwordHash).toBeUndefined();

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/billing_session=/);
    expect(cookies[0]).toMatch(/HttpOnly/i);
  });

  test('rejects a wrong password with a generic message', async () => {
    await createOwner('owner', 'secret123');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'owner', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('rejects an unknown username with the same generic message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('rejects a deactivated user even with the correct password', async () => {
    const passwordHash = await hashPassword('secret123');
    const shop = await Shop.create({ name: 'deactivated-owner shop' });
    await User.create({ username: 'owner', passwordHash, name: 'Owner', role: 'owner', isActive: false, shopId: shop._id });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'owner', password: 'secret123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('rejects an empty username/password with a validation error', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: '', password: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/auth/me', () => {
  test('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('returns 401 for a malformed cookie', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'billing_session=not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('returns the current user when authenticated', async () => {
    await createOwner('owner', 'secret123');
    const agent = request.agent(app);

    await agent.post('/api/auth/login').send({ username: 'owner', password: 'secret123' });
    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: 'owner', name: 'Owner', role: 'owner' });
  });
});

describe('POST /api/auth/logout', () => {
  test('clears the session cookie so a subsequent /me is unauthenticated', async () => {
    await createOwner('owner', 'secret123');
    const agent = request.agent(app);

    await agent.post('/api/auth/login').send({ username: 'owner', password: 'secret123' });
    await agent.post('/api/auth/logout');
    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(401);
  });
});

describe('production cookie topology', () => {
  test('login -> refresh (persisted cookie) -> authenticated request -> logout -> login again', async () => {
    await createOwner('owner', 'secret123');
    const agent = request.agent(app);

    const firstLogin = await agent.post('/api/auth/login').send({ username: 'owner', password: 'secret123' });
    expect(firstLogin.status).toBe(200);

    // A page refresh doesn't re-send credentials — it's the browser
    // re-attaching the already-set cookie on a fresh request, which is
    // exactly what reusing the same agent's cookie jar simulates here.
    const afterRefresh = await agent.get('/api/auth/me');
    expect(afterRefresh.status).toBe(200);
    expect(afterRefresh.body.user.username).toBe('owner');

    const loggedOut = await agent.post('/api/auth/logout');
    expect(loggedOut.status).toBe(200);
    expect(await agent.get('/api/auth/me')).toHaveProperty('status', 401);

    const secondLogin = await agent.post('/api/auth/login').send({ username: 'owner', password: 'secret123' });
    expect(secondLogin.status).toBe(200);
    expect(await agent.get('/api/auth/me')).toHaveProperty('status', 200);
  });

  test('sets Secure + SameSite=Strict on the cookie when NODE_ENV=production', async () => {
    await createOwner('owner', 'secret123');
    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const res = await request(app).post('/api/auth/login').send({ username: 'owner', password: 'secret123' });
      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toMatch(/Secure/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/HttpOnly/i);
    } finally {
      process.env.NODE_ENV = previousEnv;
    }
  });
});

describe('seedOwnerUser', () => {
  test('creates the owner on first run and does not overwrite it on a second run', async () => {
    process.env.SEED_OWNER_USERNAME = 'owner';
    process.env.SEED_OWNER_PASSWORD = 'first-password';
    process.env.SEED_SHOP_NAME = 'Test Shop';

    const created = await seedOwnerUser();
    expect(created.username).toBe('owner');
    expect(created.shopId).toBeTruthy();

    process.env.SEED_OWNER_PASSWORD = 'second-password';
    await seedOwnerUser();

    const stored = await User.findOne({ username: 'owner' }).select('+passwordHash');
    const count = await User.countDocuments({ username: 'owner' });

    expect(count).toBe(1);
    await expect(verifyPassword('first-password', stored.passwordHash)).resolves.toBe(true);
  });

  test('throws if SEED_OWNER_USERNAME or SEED_OWNER_PASSWORD is missing', async () => {
    delete process.env.SEED_OWNER_USERNAME;
    delete process.env.SEED_OWNER_PASSWORD;

    await expect(seedOwnerUser()).rejects.toThrow(/SEED_OWNER_USERNAME/);
  });
});
