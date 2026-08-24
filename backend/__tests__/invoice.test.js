import http from 'http';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import { loginAsOwner } from './helpers/testAuth.js';

let mongod;
let server;
let agent;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '7d';
  process.env.COOKIE_NAME = 'mahaveer_session';

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // A persistent, already-listening server is required (rather than handing
  // the bare Express app to supertest) because the concurrency tests below
  // fire many simultaneous requests — supertest spins up a brand-new
  // ephemeral HTTP server per call when given a bare app, which is fine one
  // at a time but becomes unreliable (ECONNRESET) under real concurrency.
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

async function makeCustomer(overrides = {}) {
  return Customer.create({ name: 'Ramesh Kumar', mobile: '9876543210', address: 'Athani Road', ...overrides });
}

async function makeProduct(overrides = {}) {
  return Product.create({ name: 'LED Bulb 9W', price: 150, unit: 'pcs', ...overrides });
}

async function createDraft({ customer, items, paymentMethod, paymentStatus } = {}) {
  const c = customer || (await makeCustomer());
  const p = items || [{ productId: (await makeProduct())._id.toString(), quantity: 2 }];
  const res = await agent.post('/api/invoices').send({
    customerId: c._id.toString(),
    items: p,
    paymentMethod,
    paymentStatus,
  });
  return res;
}

// A/B/C — draft create, retrieve, update
describe('draft lifecycle', () => {
  test('A: creates a draft with no invoice number', async () => {
    const customer = await makeCustomer();
    const product = await makeProduct();

    const res = await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 2 }],
    });

    expect(res.status).toBe(201);
    expect(res.body.invoice.status).toBe('draft');
    expect(res.body.invoice.invoiceNumber).toBeFalsy();
  });

  test('B: retrieves a draft', async () => {
    const created = await createDraft();
    const res = await agent.get(`/api/invoices/${created.body.invoice._id}`);
    expect(res.status).toBe(200);
    expect(res.body.invoice._id).toBe(created.body.invoice._id);
  });

  test('C: updates a draft (customer, items, payment fields)', async () => {
    const created = await createDraft();
    const newCustomer = await makeCustomer({ name: 'Suresh', mobile: '9988776655' });

    const res = await agent.patch(`/api/invoices/${created.body.invoice._id}`).send({
      customerId: newCustomer._id.toString(),
      paymentMethod: 'upi',
      paymentStatus: 'pending',
    });

    expect(res.status).toBe(200);
    expect(res.body.invoice.customer.name).toBe('Suresh');
    expect(res.body.invoice.paymentMethod).toBe('upi');
    expect(res.body.invoice.paymentStatus).toBe('pending');
  });

  test('a draft can be saved with an empty item list', async () => {
    const customer = await makeCustomer();
    const res = await agent.post('/api/invoices').send({ customerId: customer._id.toString(), items: [] });
    expect(res.status).toBe(201);
    expect(res.body.invoice.items).toHaveLength(0);
    expect(res.body.invoice.total).toBe(0);
  });
});

// D-H — finalize + calculation correctness + ignoring client totals
describe('finalization and money calculation', () => {
  test('D/O: finalizing a draft assigns an invoice number and flips status', async () => {
    const created = await createDraft();
    const res = await agent.post(`/api/invoices/${created.body.invoice._id}/finalize`);

    expect(res.status).toBe(200);
    expect(res.body.invoice.status).toBe('finalized');
    expect(res.body.invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
  });

  test('E/F/G: backend computes subtotal, tax, and total correctly', async () => {
    const product = await makeProduct({ price: 150 });
    const created = await createDraft({ items: [{ productId: product._id.toString(), quantity: 3 }] });
    const res = await agent.post(`/api/invoices/${created.body.invoice._id}/finalize`);

    expect(res.body.invoice.subtotal).toBe(450);
    expect(res.body.invoice.taxRate).toBe(0.18);
    expect(res.body.invoice.taxAmount).toBe(81);
    expect(res.body.invoice.total).toBe(531);
    expect(res.body.invoice.amountInWords).toBe('Five Hundred Thirty One Rupees');
  });

  test('H: backend ignores manipulated client-supplied totals', async () => {
    const customer = await makeCustomer();
    const product = await makeProduct({ price: 150 });

    const res = await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 2 }],
      subtotal: 1,
      taxAmount: 1,
      total: 1,
      invoiceNumber: 'INV-2026-9999',
      amountInWords: 'One Rupee',
    });

    expect(res.status).toBe(201);
    expect(res.body.invoice.subtotal).toBe(300);
    expect(res.body.invoice.total).toBe(354);
    expect(res.body.invoice.invoiceNumber).toBeFalsy();

    const finalized = await agent.post(`/api/invoices/${res.body.invoice._id}/finalize`);
    expect(finalized.body.invoice.subtotal).toBe(300);
    expect(finalized.body.invoice.total).toBe(354);
    expect(finalized.body.invoice.invoiceNumber).not.toBe('INV-2026-9999');
  });

  test('I: backend uses the database product price, not a client-supplied one', async () => {
    const customer = await makeCustomer();
    const product = await makeProduct({ price: 150 });

    const res = await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 1, price: 1 }],
    });

    expect(res.body.invoice.items[0].price).toBe(150);
    expect(res.body.invoice.subtotal).toBe(150);
  });
});

// J/K/L/M — snapshot semantics
describe('snapshot immutability', () => {
  test('J: customer snapshot is stored on the invoice', async () => {
    const customer = await makeCustomer({ name: 'Ramesh Kumar', mobile: '9876543210', address: 'Athani Road' });
    const created = await createDraft({ customer });
    const res = await agent.post(`/api/invoices/${created.body.invoice._id}/finalize`);

    expect(res.body.invoice.customer).toMatchObject({
      name: 'Ramesh Kumar',
      mobile: '9876543210',
      address: 'Athani Road',
    });
  });

  test('K: product snapshot is stored on the invoice', async () => {
    const product = await makeProduct({ name: 'LED Bulb 9W', price: 150, unit: 'pcs' });
    const created = await createDraft({ items: [{ productId: product._id.toString(), quantity: 2 }] });
    const res = await agent.post(`/api/invoices/${created.body.invoice._id}/finalize`);

    expect(res.body.invoice.items[0]).toMatchObject({ name: 'LED Bulb 9W', price: 150, unit: 'pcs', quantity: 2, lineTotal: 300 });
  });

  test('L: a finalized invoice is unaffected by a later customer edit', async () => {
    const customer = await makeCustomer({ name: 'Ramesh Kumar' });
    const created = await createDraft({ customer });
    const finalized = await agent.post(`/api/invoices/${created.body.invoice._id}/finalize`);

    await agent.patch(`/api/customers/${customer._id}`).send({ name: 'Ramesh Kumar Renamed' });

    const reread = await agent.get(`/api/invoices/${finalized.body.invoice._id}`);
    expect(reread.body.invoice.customer.name).toBe('Ramesh Kumar');
  });

  test('M: a finalized invoice is unaffected by a later product price change', async () => {
    const product = await makeProduct({ price: 150 });
    const created = await createDraft({ items: [{ productId: product._id.toString(), quantity: 2 }] });
    const finalized = await agent.post(`/api/invoices/${created.body.invoice._id}/finalize`);

    await agent.patch(`/api/products/${product._id}`).send({ price: 999 });

    const reread = await agent.get(`/api/invoices/${finalized.body.invoice._id}`);
    expect(reread.body.invoice.items[0].price).toBe(150);
    expect(reread.body.invoice.total).toBe(finalized.body.invoice.total);
  });
});

// N/P/Q — numbering
describe('invoice numbering', () => {
  test('N: a draft never receives a permanent invoice number, even with items', async () => {
    const created = await createDraft();
    expect(created.body.invoice.invoiceNumber).toBeFalsy();
  });

  test('P/Q: sequential finalizations receive unique, incrementing numbers', async () => {
    const first = await createDraft();
    const second = await createDraft();

    const firstFinal = await agent.post(`/api/invoices/${first.body.invoice._id}/finalize`);
    const secondFinal = await agent.post(`/api/invoices/${second.body.invoice._id}/finalize`);

    expect(firstFinal.body.invoice.invoiceNumber).not.toBe(secondFinal.body.invoice.invoiceNumber);

    const firstSeq = Number(firstFinal.body.invoice.invoiceNumber.split('-')[2]);
    const secondSeq = Number(secondFinal.body.invoice.invoiceNumber.split('-')[2]);
    expect(secondSeq).toBe(firstSeq + 1);
  });
});

// R — concurrency
describe('concurrent finalization', () => {
  test('R: finalizing many different drafts concurrently yields all-unique invoice numbers', async () => {
    const drafts = await Promise.all(Array.from({ length: 10 }, () => createDraft()));

    const results = await Promise.all(
      drafts.map((d) => agent.post(`/api/invoices/${d.body.invoice._id}/finalize`)),
    );

    expect(results.every((r) => r.status === 200)).toBe(true);

    const numbers = results.map((r) => r.body.invoice.invoiceNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  test('double-finalizing the same draft concurrently: exactly one wins, the other gets 409', async () => {
    const created = await createDraft();
    const id = created.body.invoice._id;

    const [a, b] = await Promise.all([
      agent.post(`/api/invoices/${id}/finalize`),
      agent.post(`/api/invoices/${id}/finalize`),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    const winner = a.status === 200 ? a : b;
    const loser = a.status === 200 ? b : a;
    expect(winner.body.invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(loser.body.error.code).toBe('CONFLICT');

    const finalDoc = await Invoice.findById(id);
    expect(finalDoc.status).toBe('finalized');
  });
});

// S — immutability after finalization
describe('finalized invoice immutability', () => {
  test('S: a finalized invoice cannot be edited via PATCH', async () => {
    const created = await createDraft();
    const finalized = await agent.post(`/api/invoices/${created.body.invoice._id}/finalize`);

    const anotherCustomer = await makeCustomer({ name: 'Someone Else' });
    const res = await agent
      .patch(`/api/invoices/${finalized.body.invoice._id}`)
      .send({ customerId: anotherCustomer._id.toString() });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE');

    const reread = await agent.get(`/api/invoices/${finalized.body.invoice._id}`);
    expect(reread.body.invoice.customer.name).not.toBe('Someone Else');
  });

  test('W: a non-draft invoice (cancelled) cannot be finalized', async () => {
    const created = await createDraft();
    await Invoice.findByIdAndUpdate(created.body.invoice._id, { status: 'cancelled' });

    const res = await agent.post(`/api/invoices/${created.body.invoice._id}/finalize`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  test('W: an already-finalized invoice cannot be finalized again', async () => {
    const created = await createDraft();
    await agent.post(`/api/invoices/${created.body.invoice._id}/finalize`);

    const res = await agent.post(`/api/invoices/${created.body.invoice._id}/finalize`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });
});

// T/U — validation
describe('validation', () => {
  test('T: zero or negative quantity is rejected', async () => {
    const customer = await makeCustomer();
    const product = await makeProduct();

    const zero = await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 0 }],
    });
    expect(zero.status).toBe(400);
    expect(zero.body.error.code).toBe('VALIDATION_ERROR');

    const negative = await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: -1 }],
    });
    expect(negative.status).toBe(400);
  });

  test('U: a malformed product id is rejected', async () => {
    const customer = await makeCustomer();
    const res = await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: 'not-an-id', quantity: 1 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('U: a well-formed but nonexistent product id is rejected', async () => {
    const customer = await makeCustomer();
    const res = await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: new mongoose.Types.ObjectId().toString(), quantity: 1 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PRODUCT');
  });

  test('rejects a missing/invalid customer', async () => {
    const product = await makeProduct();
    const res = await agent.post('/api/invoices').send({
      customerId: new mongoose.Types.ObjectId().toString(),
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CUSTOMER');
  });

  test('rejects finalizing an invoice whose item references a now-inactive product', async () => {
    const product = await makeProduct();
    const created = await createDraft({ items: [{ productId: product._id.toString(), quantity: 1 }] });

    await Product.findByIdAndUpdate(product._id, { isActive: false });

    const res = await agent.post(`/api/invoices/${created.body.invoice._id}/finalize`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INACTIVE_PRODUCT');
  });

  test('rejects finalizing an empty invoice', async () => {
    const customer = await makeCustomer();
    const draft = await agent.post('/api/invoices').send({ customerId: customer._id.toString(), items: [] });

    const res = await agent.post(`/api/invoices/${draft.body.invoice._id}/finalize`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EMPTY_INVOICE');
  });
});

// V — authorization
describe('authorization', () => {
  test('V: all invoice endpoints require authentication', async () => {
    const customer = await makeCustomer();
    const product = await makeProduct();
    const created = await createDraft();

    const anonymous = request(server);
    const results = await Promise.all([
      anonymous.get('/api/invoices'),
      anonymous.post('/api/invoices').send({ customerId: customer._id.toString(), items: [] }),
      anonymous.get(`/api/invoices/${created.body.invoice._id}`),
      anonymous.patch(`/api/invoices/${created.body.invoice._id}`).send({}),
      anonymous.post(`/api/invoices/${created.body.invoice._id}/finalize`),
    ]);

    expect(results.every((r) => r.status === 401)).toBe(true);
  });
});

// GET /api/invoices minimal listing
describe('GET /api/invoices', () => {
  test('lists invoices filtered by status', async () => {
    const d1 = await createDraft();
    const d2 = await createDraft();
    await agent.post(`/api/invoices/${d2.body.invoice._id}/finalize`);

    const draftsOnly = await agent.get('/api/invoices').query({ status: 'draft' });
    expect(draftsOnly.body.invoices).toHaveLength(1);
    expect(draftsOnly.body.invoices[0]._id).toBe(d1.body.invoice._id);

    const finalizedOnly = await agent.get('/api/invoices').query({ status: 'finalized' });
    expect(finalizedOnly.body.invoices).toHaveLength(1);
  });
});
