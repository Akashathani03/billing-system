import http from 'http';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import { loginAsOwner } from './helpers/testAuth.js';
import { createFinalizedInvoice } from './helpers/invoiceHelpers.js';

let mongod;
let server;
let agent;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '7d';
  process.env.COOKIE_NAME = 'billing_session';

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  server.close();
});

beforeEach(async () => {
  agent = await loginAsOwner(server);
});

afterEach(async () => {
  await Invoice.deleteMany({});
  await Customer.deleteMany({});
  await Product.deleteMany({});
  await mongoose.connection.collection('users').deleteMany({});
  await mongoose.connection.collection('counters').deleteMany({});
});

describe('PATCH /api/invoices/:id/payment-status', () => {
  test('L: moves pending to paid', async () => {
    const { invoice } = await createFinalizedInvoice(agent, { paymentMethod: 'credit', paymentStatus: 'pending' });

    const res = await agent.patch(`/api/invoices/${invoice._id}/payment-status`).send({ paymentStatus: 'paid' });

    expect(res.status).toBe(200);
    expect(res.body.invoice.paymentStatus).toBe('paid');
  });

  test('M: rejects paid to pending', async () => {
    const { invoice } = await createFinalizedInvoice(agent, { paymentStatus: 'paid' });

    const res = await agent.patch(`/api/invoices/${invoice._id}/payment-status`).send({ paymentStatus: 'pending' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');

    const reread = await agent.get(`/api/invoices/${invoice._id}`);
    expect(reread.body.invoice.paymentStatus).toBe('paid');
  });

  test('rejects re-marking an already-paid invoice as paid again (no duplicate transition)', async () => {
    const { invoice } = await createFinalizedInvoice(agent, { paymentStatus: 'paid' });

    const res = await agent.patch(`/api/invoices/${invoice._id}/payment-status`).send({ paymentStatus: 'paid' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  test('N/O/P/Q/R: records a complete, correct audit entry', async () => {
    const { invoice } = await createFinalizedInvoice(agent, { paymentMethod: 'credit', paymentStatus: 'pending' });
    const before = new Date();

    const res = await agent.patch(`/api/invoices/${invoice._id}/payment-status`).send({ paymentStatus: 'paid' });

    expect(res.body.invoice.paymentHistory).toHaveLength(1);
    const entry = res.body.invoice.paymentHistory[0];
    expect(entry.previousStatus).toBe('pending');
    expect(entry.newStatus).toBe('paid');
    expect(entry.changedBy).toBeTruthy();
    expect(new Date(entry.changedAt).getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
  });

  test('S: financial fields are unchanged by a payment-status update', async () => {
    const { invoice } = await createFinalizedInvoice(agent, { paymentMethod: 'credit', paymentStatus: 'pending' });

    const res = await agent.patch(`/api/invoices/${invoice._id}/payment-status`).send({ paymentStatus: 'paid' });

    expect(res.body.invoice.invoiceNumber).toBe(invoice.invoiceNumber);
    expect(res.body.invoice.customer).toEqual(invoice.customer);
    expect(res.body.invoice.items).toEqual(invoice.items);
    expect(res.body.invoice.subtotal).toBe(invoice.subtotal);
    expect(res.body.invoice.total).toBe(invoice.total);
    expect(res.body.invoice.amountInWords).toBe(invoice.amountInWords);
  });

  test('T: unauthorized access is rejected', async () => {
    const { invoice } = await createFinalizedInvoice(agent, { paymentStatus: 'pending' });

    const res = await request(server)
      .patch(`/api/invoices/${invoice._id}/payment-status`)
      .send({ paymentStatus: 'paid' });

    expect(res.status).toBe(401);
  });

  test('U: an invalid invoice id is rejected', async () => {
    const res = await agent.patch('/api/invoices/not-an-id/payment-status').send({ paymentStatus: 'paid' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('V: a non-finalized invoice is rejected', async () => {
    const customer = await Customer.create({ shopId: agent.shopId, name: 'X', mobile: '9000000000' });
    const product = await Product.create({ shopId: agent.shopId, name: 'Y', price: 100 });
    const draft = await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });

    const res = await agent
      .patch(`/api/invoices/${draft.body.invoice._id}/payment-status`)
      .send({ paymentStatus: 'paid' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  test('W: concurrent payment updates on the same invoice produce exactly one transition and one audit entry', async () => {
    const { invoice } = await createFinalizedInvoice(agent, { paymentMethod: 'credit', paymentStatus: 'pending' });

    const [a, b] = await Promise.all([
      agent.patch(`/api/invoices/${invoice._id}/payment-status`).send({ paymentStatus: 'paid' }),
      agent.patch(`/api/invoices/${invoice._id}/payment-status`).send({ paymentStatus: 'paid' }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    const finalDoc = await Invoice.findById(invoice._id);
    expect(finalDoc.paymentStatus).toBe('paid');
    expect(finalDoc.paymentHistory).toHaveLength(1);
  });
});
