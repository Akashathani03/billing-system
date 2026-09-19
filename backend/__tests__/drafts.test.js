import request from 'supertest';
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

async function makeCustomerAndProduct() {
  const customer = await Customer.create({ shopId: agent.shopId, name: 'Ramesh Kumar', mobile: '9876543210' });
  const product = await Product.create({ shopId: agent.shopId, name: 'LED Bulb 9W', price: 150, unit: 'pcs' });
  return { customer, product };
}

/**
 * This file is the Phase 7 "draft audit" — it walks the entire draft
 * lifecycle end to end in one place (some individual steps are already
 * covered elsewhere from earlier phases; this suite exists specifically to
 * demonstrate and pin down the full journey together).
 */
describe('draft lifecycle audit', () => {
  test('A: create draft — no invoice number, status draft, invoice collection only (no separate Draft model)', async () => {
    const { customer, product } = await makeCustomerAndProduct();

    const res = await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 2 }],
    });

    expect(res.status).toBe(201);
    expect(res.body.invoice.status).toBe('draft');
    expect(res.body.invoice.invoiceNumber).toBeFalsy();

    const stored = await Invoice.findById(res.body.invoice._id);
    expect(stored).not.toBeNull();
  });

  test('B: list drafts', async () => {
    const { customer, product } = await makeCustomerAndProduct();
    await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });

    const res = await agent.get('/api/invoices').query({ status: 'draft' });
    expect(res.status).toBe(200);
    expect(res.body.invoices).toHaveLength(1);
    expect(res.body.invoices[0].status).toBe('draft');
  });

  test('C/D/E: get, update, and reopen a draft (edits persist across a fresh fetch)', async () => {
    const { customer, product } = await makeCustomerAndProduct();
    const created = await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });
    const id = created.body.invoice._id;

    // C: get
    const got = await agent.get(`/api/invoices/${id}`);
    expect(got.status).toBe(200);

    // D: update
    const updated = await agent.patch(`/api/invoices/${id}`).send({
      items: [{ productId: product._id.toString(), quantity: 3 }],
      paymentMethod: 'upi',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.invoice.paymentMethod).toBe('upi');
    expect(updated.body.invoice.items[0].quantity).toBe(3);

    // E: reopen — a fresh GET (simulating navigating away and back) reflects the saved edit
    const reopened = await agent.get(`/api/invoices/${id}`);
    expect(reopened.body.invoice.paymentMethod).toBe('upi');
    expect(reopened.body.invoice.items[0].quantity).toBe(3);
    expect(reopened.body.invoice.total).toBe(updated.body.invoice.total);
  });

  test('F/G: finalize a draft, then confirm it can no longer be edited', async () => {
    const { customer, product } = await makeCustomerAndProduct();
    const created = await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });
    const id = created.body.invoice._id;

    const finalized = await agent.post(`/api/invoices/${id}/finalize`);
    expect(finalized.status).toBe(200);
    expect(finalized.body.invoice.status).toBe('finalized');
    expect(finalized.body.invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);

    const editAttempt = await agent.patch(`/api/invoices/${id}`).send({ paymentMethod: 'credit' });
    expect(editAttempt.status).toBe(409);
    expect(editAttempt.body.error.code).toBe('INVALID_STATE');

    const reread = await agent.get(`/api/invoices/${id}`);
    expect(reread.body.invoice.paymentMethod).not.toBe('credit');
  });

  test('H/I/J: a draft contributes to no finalized-only view — billing history, dashboard, or sales', async () => {
    const { customer, product } = await makeCustomerAndProduct();
    await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });

    const history = await agent.get('/api/invoices').query({ status: 'finalized' });
    expect(history.body.invoices).toHaveLength(0);

    const dashboard = await agent.get('/api/dashboard/summary');
    expect(dashboard.body.today).toEqual({ sales: 0, bills: 0, paid: 0, pending: 0 });
    expect(dashboard.body.recentBills).toEqual([]);
  });

  test('K: a draft cannot generate a PDF', async () => {
    const { customer, product } = await makeCustomerAndProduct();
    const created = await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });

    const res = await agent.get(`/api/invoices/${created.body.invoice._id}/pdf`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  test('L: createdBy is preserved through update and finalize', async () => {
    const { customer, product } = await makeCustomerAndProduct();
    const created = await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });
    const originalCreatedBy = created.body.invoice.createdBy;
    expect(originalCreatedBy).toBeTruthy();

    const updated = await agent
      .patch(`/api/invoices/${created.body.invoice._id}`)
      .send({ paymentMethod: 'upi' });
    expect(updated.body.invoice.createdBy).toBe(originalCreatedBy);

    const finalized = await agent.post(`/api/invoices/${created.body.invoice._id}/finalize`);
    expect(finalized.body.invoice.createdBy).toBe(originalCreatedBy);
  });
});

describe('draft deletion', () => {
  test('a draft can be deleted, and is then gone', async () => {
    const { customer, product } = await makeCustomerAndProduct();
    const created = await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });

    const res = await agent.delete(`/api/invoices/${created.body.invoice._id}`);
    expect(res.status).toBe(200);

    const reread = await agent.get(`/api/invoices/${created.body.invoice._id}`);
    expect(reread.status).toBe(404);
  });

  test('a finalized invoice cannot be deleted', async () => {
    const { customer, product } = await makeCustomerAndProduct();
    const created = await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });
    const finalized = await agent.post(`/api/invoices/${created.body.invoice._id}/finalize`);

    const res = await agent.delete(`/api/invoices/${finalized.body.invoice._id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE');

    const stillThere = await Invoice.findById(finalized.body.invoice._id);
    expect(stillThere).not.toBeNull();
  });

  test('deleting a nonexistent invoice returns 404', async () => {
    const res = await agent.delete(`/api/invoices/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(404);
  });

  test('deleting requires authentication', async () => {
    const { customer, product } = await makeCustomerAndProduct();
    const created = await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });

    const res = await request(app).delete(`/api/invoices/${created.body.invoice._id}`);
    expect(res.status).toBe(401);
  });
});
