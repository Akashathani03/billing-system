import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import { loginAsOwner } from './helpers/testAuth.js';
import { createFinalizedInvoice } from './helpers/invoiceHelpers.js';
import { getPaymentTotals } from '../services/invoice.service.js';

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
  await Invoice.deleteMany({});
  await Customer.deleteMany({});
  await Product.deleteMany({});
  await mongoose.connection.collection('users').deleteMany({});
  await mongoose.connection.collection('counters').deleteMany({});
});

describe('getPaymentTotals (reusable aggregation, not yet wired to a route)', () => {
  test('sums finalized invoices by payment method, plus a pending total', async () => {
    await createFinalizedInvoice(agent, { paymentMethod: 'cash', price: 100, customerMobile: '9111111111' }); // total 118
    await createFinalizedInvoice(agent, { paymentMethod: 'upi', price: 200, customerMobile: '9222222222' }); // total 236
    await createFinalizedInvoice(agent, {
      paymentMethod: 'credit',
      paymentStatus: 'pending',
      price: 50,
      customerMobile: '9333333333',
    }); // total 59

    const totals = await getPaymentTotals();

    expect(totals.cash).toBe(118);
    expect(totals.upi).toBe(236);
    expect(totals.credit).toBe(59);
    expect(totals.card).toBe(0);
    expect(totals.pending).toBe(59);
  });

  test('excludes drafts', async () => {
    const customer = await Customer.create({ name: 'X', mobile: '9000000000' });
    const product = await Product.create({ name: 'Y', price: 100 });
    await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });

    const totals = await getPaymentTotals();
    expect(totals.cash).toBe(0);
  });
});
