import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import Product from '../models/Product.js';
import { loginAsOwner } from './helpers/testAuth.js';

let mongod;
let agent;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '7d';
  process.env.COOKIE_NAME = 'mahaveer_session';

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  agent = await loginAsOwner(app);
});

afterEach(async () => {
  await Product.deleteMany({});
  await mongoose.connection.collection('users').deleteMany({});
});

describe('POST /api/products', () => {
  test('creates a product with valid data', async () => {
    const res = await agent.post('/api/products').send({ name: 'LED Bulb 9W', price: 150, unit: 'pcs' });

    expect(res.status).toBe(201);
    expect(res.body.product).toMatchObject({ name: 'LED Bulb 9W', price: 150, unit: 'pcs', isActive: true });
  });

  test('rejects a zero or negative price', async () => {
    const zero = await agent.post('/api/products').send({ name: 'Wire', price: 0 });
    expect(zero.status).toBe(400);
    expect(zero.body.error.code).toBe('VALIDATION_ERROR');

    const negative = await agent.post('/api/products').send({ name: 'Wire', price: -10 });
    expect(negative.status).toBe(400);
  });

  test('rejects a missing name', async () => {
    const res = await agent.post('/api/products').send({ price: 100 });
    expect(res.status).toBe(400);
  });

  test('requires authentication', async () => {
    const res = await request(app).post('/api/products').send({ name: 'Wire', price: 100 });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/products', () => {
  test('excludes inactive products by default', async () => {
    await Product.create([
      { name: 'LED Bulb', price: 150, isActive: true },
      { name: 'Old Switch', price: 45, isActive: false },
    ]);

    const res = await agent.get('/api/products');
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].name).toBe('LED Bulb');
  });

  test('includes inactive products when includeInactive=true', async () => {
    await Product.create([
      { name: 'LED Bulb', price: 150, isActive: true },
      { name: 'Old Switch', price: 45, isActive: false },
    ]);

    const res = await agent.get('/api/products').query({ includeInactive: 'true' });
    expect(res.body.products).toHaveLength(2);
  });

  test('searches by partial name, case-insensitively', async () => {
    await Product.create([
      { name: 'LED Bulb 9W', price: 150 },
      { name: 'Switch Socket', price: 45 },
    ]);

    const res = await agent.get('/api/products').query({ search: 'bulb' });
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].name).toBe('LED Bulb 9W');
  });
});

describe('PATCH /api/products/:id', () => {
  test('edits fields without hard-deleting or affecting others', async () => {
    const product = await Product.create({ name: 'LED Bulb', price: 150 });

    const res = await agent.patch(`/api/products/${product._id}`).send({ price: 180 });

    expect(res.status).toBe(200);
    expect(res.body.product).toMatchObject({ name: 'LED Bulb', price: 180, isActive: true });
  });

  test('deactivates a product (soft delete) instead of removing it', async () => {
    const product = await Product.create({ name: 'LED Bulb', price: 150 });

    const res = await agent.patch(`/api/products/${product._id}`).send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.product.isActive).toBe(false);

    const stillExists = await Product.findById(product._id);
    expect(stillExists).not.toBeNull();
  });

  test('rejects an invalid price on update', async () => {
    const product = await Product.create({ name: 'LED Bulb', price: 150 });
    const res = await agent.patch(`/api/products/${product._id}`).send({ price: -5 });
    expect(res.status).toBe(400);
  });
});
