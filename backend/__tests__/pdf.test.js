import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PDFParse } from 'pdf-parse';
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

async function parsePdf(buffer) {
  return new PDFParse({ data: buffer }).getText();
}

async function extractText(buffer) {
  const parsed = await parsePdf(buffer);
  return parsed.text;
}

describe('GET /api/invoices/:id/pdf', () => {
  test('A/Q: unauthenticated request is rejected', async () => {
    const { invoice } = await createFinalizedInvoice(agent);
    const res = await request(app).get(`/api/invoices/${invoice._id}/pdf`);
    expect(res.status).toBe(401);
  });

  test('B: a malformed invoice id is rejected', async () => {
    const res = await agent.get('/api/invoices/not-an-id/pdf');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('C: a well-formed but nonexistent invoice id is rejected', async () => {
    const res = await agent.get(`/api/invoices/${new mongoose.Types.ObjectId()}/pdf`);
    expect(res.status).toBe(404);
  });

  test('D: a draft invoice cannot generate a PDF', async () => {
    const customer = await Customer.create({ shopId: agent.shopId, name: 'X', mobile: '9000000000' });
    const product = await Product.create({ shopId: agent.shopId, name: 'Y', price: 100 });
    const draft = await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });

    const res = await agent.get(`/api/invoices/${draft.body.invoice._id}/pdf`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  test('E/F/G/H/I: a finalized invoice produces a real, non-empty PDF with correct headers', async () => {
    const { invoice } = await createFinalizedInvoice(agent);
    const res = await agent.get(`/api/invoices/${invoice._id}/pdf`).buffer(true).parse((response, cb) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => cb(null, Buffer.concat(chunks)));
    });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain(invoice.invoiceNumber);
    expect(res.headers['content-disposition']).toContain('inline');

    const buffer = res.body;
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');

    const parsed = await parsePdf(buffer);
    expect(parsed.total).toBeGreaterThanOrEqual(1);
  });

  test('download=1 requests an attachment disposition', async () => {
    const { invoice } = await createFinalizedInvoice(agent);
    const res = await agent.get(`/api/invoices/${invoice._id}/pdf`).query({ download: '1' });
    expect(res.headers['content-disposition']).toContain('attachment');
  });

  test('J/K/L/M/N: the PDF text contains the invoice number, customer, product, total, and amount in words', async () => {
    const { invoice } = await createFinalizedInvoice(agent, {
      customerName: 'Ramesh Kumar',
      customerMobile: '9876543210',
      productName: 'LED Bulb 9W',
      price: 150,
      quantity: 2,
    });

    const res = await agent.get(`/api/invoices/${invoice._id}/pdf`).buffer(true).parse((response, cb) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => cb(null, Buffer.concat(chunks)));
    });

    const text = await extractText(res.body);

    expect(text).toContain(invoice.invoiceNumber);
    expect(text).toContain('Ramesh Kumar');
    expect(text).toContain('9876543210');
    expect(text).toContain('LED Bulb 9W');
    expect(text).toContain(invoice.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    expect(text).toContain(invoice.amountInWords);
  });

  test('O: a later product price change does not affect the already-generated PDF', async () => {
    const { invoice, product } = await createFinalizedInvoice(agent, { productName: 'LED Bulb', price: 150 });

    await agent.patch(`/api/products/${product._id}`).send({ price: 999 });

    const res = await agent.get(`/api/invoices/${invoice._id}/pdf`).buffer(true).parse((response, cb) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    const text = await extractText(res.body);

    expect(text).toContain('150.00');
    expect(text).not.toContain('999.00');
  });

  test('P: a later customer profile change does not affect the already-generated PDF', async () => {
    const { invoice, customer } = await createFinalizedInvoice(agent, { customerName: 'Ramesh Kumar' });

    await agent.patch(`/api/customers/${customer._id}`).send({ name: 'Someone Else Entirely' });

    const res = await agent.get(`/api/invoices/${invoice._id}/pdf`).buffer(true).parse((response, cb) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    const text = await extractText(res.body);

    expect(text).toContain('Ramesh Kumar');
    expect(text).not.toContain('Someone Else Entirely');
  });

  test('a cancelled invoice still produces a PDF, clearly marked as cancelled', async () => {
    const { invoice } = await createFinalizedInvoice(agent);
    await Invoice.findByIdAndUpdate(invoice._id, { status: 'cancelled' });

    const res = await agent.get(`/api/invoices/${invoice._id}/pdf`).buffer(true).parse((response, cb) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => cb(null, Buffer.concat(chunks)));
    });

    expect(res.status).toBe(200);
    const text = await extractText(res.body);
    expect(text).toContain('CANCELLED');
  });
});
