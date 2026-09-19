import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
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
  await Invoice.deleteMany({});
  await Customer.deleteMany({});
  await Product.deleteMany({});
  await mongoose.connection.collection('users').deleteMany({});
  await mongoose.connection.collection('counters').deleteMany({});
});

async function billFor(customer, product, quantity) {
  const draft = await agent.post('/api/invoices').send({
    customerId: customer._id.toString(),
    items: [{ productId: product._id.toString(), quantity }],
  });
  return agent.post(`/api/invoices/${draft.body.invoice._id}/finalize`);
}

describe('GET /api/customers/:id/invoices', () => {
  test('X: returns the customer finalized billing history', async () => {
    const customer = await Customer.create({ shopId: agent.shopId, name: 'Ramesh', mobile: '9876543210' });
    const other = await Customer.create({ shopId: agent.shopId, name: 'Suresh', mobile: '9988776655' });
    const product = await Product.create({ shopId: agent.shopId, name: 'LED Bulb', price: 100 });

    await billFor(customer, product, 1);
    await billFor(other, product, 1);

    const res = await agent.get(`/api/customers/${customer._id}/invoices`);
    expect(res.status).toBe(200);
    expect(res.body.invoices).toHaveLength(1);
    expect(res.body.invoices[0].customer.customerId).toBe(customer._id.toString());
  });

  test('Y: totals reflect finalized invoices', async () => {
    const customer = await Customer.create({ shopId: agent.shopId, name: 'Ramesh', mobile: '9876543210' });
    const product = await Product.create({ shopId: agent.shopId, name: 'LED Bulb', price: 100 });

    await billFor(customer, product, 1); // 100
    await billFor(customer, product, 2); // 200

    const res = await agent.get(`/api/customers/${customer._id}/invoices`);
    expect(res.body.totalBills).toBe(2);
    expect(res.body.totalPurchaseValue).toBe(300);
  });

  test('Z: drafts are excluded from the customer\'s bill count and totals', async () => {
    const customer = await Customer.create({ shopId: agent.shopId, name: 'Ramesh', mobile: '9876543210' });
    const product = await Product.create({ shopId: agent.shopId, name: 'LED Bulb', price: 100 });

    await billFor(customer, product, 1); // one finalized bill

    await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 5 }],
    }); // a second invoice left as a draft — should not count

    const res = await agent.get(`/api/customers/${customer._id}/invoices`);
    expect(res.body.totalBills).toBe(1);
    expect(res.body.totalPurchaseValue).toBe(100);
  });

  test('cancelled invoices are excluded from the customer history and totals', async () => {
    const customer = await Customer.create({ shopId: agent.shopId, name: 'Ramesh', mobile: '9876543210' });
    const product = await Product.create({ shopId: agent.shopId, name: 'LED Bulb', price: 100 });

    const finalized = await billFor(customer, product, 1);
    await Invoice.findByIdAndUpdate(finalized.body.invoice._id, { status: 'cancelled' });

    const res = await agent.get(`/api/customers/${customer._id}/invoices`);
    expect(res.body.invoices).toHaveLength(0);
    expect(res.body.totalBills).toBe(0);
    expect(res.body.totalPurchaseValue).toBe(0);
  });

  test('returns 404 for a nonexistent customer', async () => {
    const res = await agent.get(`/api/customers/${new mongoose.Types.ObjectId()}/invoices`);
    expect(res.status).toBe(404);
  });
});
