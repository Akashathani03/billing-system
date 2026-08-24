import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import { loginAsOwner } from './helpers/testAuth.js';
import { createFinalizedInvoice } from './helpers/invoiceHelpers.js';

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

describe('GET /api/invoices — billing history', () => {
  test('A: returns finalized invoices', async () => {
    const { invoice } = await createFinalizedInvoice(agent);
    const res = await agent.get('/api/invoices').query({ status: 'finalized' });
    expect(res.status).toBe(200);
    expect(res.body.invoices).toHaveLength(1);
    expect(res.body.invoices[0]._id).toBe(invoice._id);
  });

  test('B: excludes drafts', async () => {
    const customer = await Customer.create({ name: 'X', mobile: '9000000000' });
    const product = await Product.create({ name: 'Y', price: 100 });
    await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });

    const res = await agent.get('/api/invoices').query({ status: 'finalized' });
    expect(res.body.invoices).toHaveLength(0);
  });

  test('C: search by invoice number', async () => {
    const { invoice } = await createFinalizedInvoice(agent);
    const partial = invoice.invoiceNumber.slice(-4);
    const res = await agent.get('/api/invoices').query({ status: 'finalized', search: partial });
    expect(res.body.invoices).toHaveLength(1);
  });

  test('D: search by customer name', async () => {
    await createFinalizedInvoice(agent, { customerName: 'Ramesh Kumar' });
    const res = await agent.get('/api/invoices').query({ status: 'finalized', search: 'ramesh' });
    expect(res.body.invoices).toHaveLength(1);
  });

  test('E: search by customer mobile', async () => {
    await createFinalizedInvoice(agent, { customerMobile: '9988776655' });
    const res = await agent.get('/api/invoices').query({ status: 'finalized', search: '8877' });
    expect(res.body.invoices).toHaveLength(1);
  });

  test('F: date filtering', async () => {
    await createFinalizedInvoice(agent);
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const inRange = await agent.get('/api/invoices').query({ status: 'finalized', dateFrom: today, dateTo: today });
    expect(inRange.body.invoices).toHaveLength(1);

    const future = await agent.get('/api/invoices').query({ status: 'finalized', dateFrom: tomorrow });
    expect(future.body.invoices).toHaveLength(0);
  });

  test('G: payment method filtering', async () => {
    await createFinalizedInvoice(agent, { paymentMethod: 'upi', customerMobile: '9111111111' });
    await createFinalizedInvoice(agent, { paymentMethod: 'cash', customerMobile: '9222222222' });

    const res = await agent.get('/api/invoices').query({ status: 'finalized', paymentMethod: 'upi' });
    expect(res.body.invoices).toHaveLength(1);
    expect(res.body.invoices[0].paymentMethod).toBe('upi');
  });

  test('H: payment status filtering', async () => {
    await createFinalizedInvoice(agent, { paymentStatus: 'paid', customerMobile: '9111111111' });
    await createFinalizedInvoice(agent, {
      paymentMethod: 'credit',
      paymentStatus: 'pending',
      customerMobile: '9222222222',
    });

    const res = await agent.get('/api/invoices').query({ status: 'finalized', paymentStatus: 'pending' });
    expect(res.body.invoices).toHaveLength(1);
    expect(res.body.invoices[0].paymentStatus).toBe('pending');
  });

  test('I: combined filters — credit + pending', async () => {
    await createFinalizedInvoice(agent, {
      paymentMethod: 'credit',
      paymentStatus: 'pending',
      customerMobile: '9111111111',
    });
    await createFinalizedInvoice(agent, {
      paymentMethod: 'credit',
      paymentStatus: 'paid',
      customerMobile: '9222222222',
    });
    await createFinalizedInvoice(agent, {
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      customerMobile: '9333333333',
    });

    const res = await agent
      .get('/api/invoices')
      .query({ status: 'finalized', paymentMethod: 'credit', paymentStatus: 'pending' });
    expect(res.body.invoices).toHaveLength(1);
    expect(res.body.invoices[0]).toMatchObject({ paymentMethod: 'credit', paymentStatus: 'pending' });
  });

  test('J: pagination', async () => {
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await createFinalizedInvoice(agent, { customerName: `Cust ${i}`, customerMobile: `90000000${i}` });
    }
    const res = await agent.get('/api/invoices').query({ status: 'finalized', page: 2, limit: 2 });
    expect(res.body.invoices).toHaveLength(2);
    expect(res.body.total).toBe(5);
    expect(res.body.page).toBe(2);
  });

  test('K: invoice detail retrieval returns full stored data', async () => {
    const { invoice } = await createFinalizedInvoice(agent);
    const res = await agent.get(`/api/invoices/${invoice._id}`);
    expect(res.status).toBe(200);
    expect(res.body.invoice.invoiceNumber).toBe(invoice.invoiceNumber);
    expect(res.body.invoice.amountInWords).toBeTruthy();
    expect(res.body.invoice.items[0].name).toBeTruthy();
  });

  test('cancelled invoices do not appear in finalized billing history', async () => {
    const { invoice } = await createFinalizedInvoice(agent);
    await Invoice.findByIdAndUpdate(invoice._id, { status: 'cancelled' });

    const res = await agent.get('/api/invoices').query({ status: 'finalized' });
    expect(res.body.invoices).toHaveLength(0);
  });
});
