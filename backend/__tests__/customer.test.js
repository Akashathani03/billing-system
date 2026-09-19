import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import Customer from '../models/Customer.js';
import { loginAsOwner } from './helpers/testAuth.js';

let mongod;
let agent;

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

beforeEach(async () => {
  agent = await loginAsOwner(app);
});

afterEach(async () => {
  await Customer.deleteMany({});
  await mongoose.connection.collection('users').deleteMany({});
});

describe('POST /api/customers', () => {
  test('creates a customer with valid data', async () => {
    const res = await agent.post('/api/customers').send({ name: 'Ramesh', mobile: '9876543210' });

    expect(res.status).toBe(201);
    expect(res.body.customer).toMatchObject({ name: 'Ramesh', mobile: '9876543210' });
  });

  test('rejects a missing name', async () => {
    const res = await agent.post('/api/customers').send({ mobile: '9876543210' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects an invalid mobile number', async () => {
    const res = await agent.post('/api/customers').send({ name: 'Ramesh', mobile: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('requires authentication', async () => {
    const res = await request(app).post('/api/customers').send({ name: 'Ramesh', mobile: '9876543210' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/customers', () => {
  test('searches by partial name or mobile, case-insensitively', async () => {
    await Customer.create([
      { shopId: agent.shopId, name: 'Ramesh Kumar', mobile: '9876543210' },
      { shopId: agent.shopId, name: 'Suresh', mobile: '9988776655' },
      { shopId: agent.shopId, name: 'Mahesh', mobile: '9000011111' },
    ]);

    const byName = await agent.get('/api/customers').query({ search: 'ramesh' });
    expect(byName.body.customers).toHaveLength(1);
    expect(byName.body.customers[0].name).toBe('Ramesh Kumar');

    const byMobile = await agent.get('/api/customers').query({ search: '8877' });
    expect(byMobile.body.customers).toHaveLength(1);
    expect(byMobile.body.customers[0].name).toBe('Suresh');
  });

  test('paginates results', async () => {
    const docs = Array.from({ length: 25 }, (_, i) => ({ shopId: agent.shopId, name: `Customer ${i}`, mobile: `900000${i}` }));
    await Customer.create(docs);

    const res = await agent.get('/api/customers').query({ page: 2, limit: 10 });
    expect(res.body.customers).toHaveLength(10);
    expect(res.body.total).toBe(25);
    expect(res.body.page).toBe(2);
  });
});

describe('GET /api/customers/:id', () => {
  test('returns 404 for a well-formed but nonexistent id', async () => {
    const res = await agent.get(`/api/customers/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(404);
  });

  test('returns 400 for a malformed id', async () => {
    const res = await agent.get('/api/customers/not-an-id');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns the customer', async () => {
    const customer = await Customer.create({ shopId: agent.shopId, name: 'Ramesh', mobile: '9876543210' });
    const res = await agent.get(`/api/customers/${customer._id}`);
    expect(res.status).toBe(200);
    expect(res.body.customer.name).toBe('Ramesh');
  });
});

describe('PATCH /api/customers/:id', () => {
  test('updates only the provided fields, leaving others untouched', async () => {
    const customer = await Customer.create({
      shopId: agent.shopId,
      name: 'Ramesh',
      mobile: '9876543210',
      address: 'Athani Road',
    });

    const res = await agent.patch(`/api/customers/${customer._id}`).send({ mobile: '9999999999' });

    expect(res.status).toBe(200);
    expect(res.body.customer).toMatchObject({
      name: 'Ramesh',
      mobile: '9999999999',
      address: 'Athani Road',
    });
  });
});
