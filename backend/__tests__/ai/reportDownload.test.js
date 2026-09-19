import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app.js';
import Invoice from '../../models/Invoice.js';
import Customer from '../../models/Customer.js';
import Product from '../../models/Product.js';
import Shop from '../../models/Shop.js';
import { loginAsOwner } from '../helpers/testAuth.js';
import { createFinalizedInvoice } from '../helpers/invoiceHelpers.js';
import { generateReport, _testOnlyClearReports } from '../../services/ai/report.service.js';

let mongod;
let shopA;
let shopB;

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
  _testOnlyClearReports();
  shopA = await loginAsOwner(app, { username: 'shopa', shopName: 'Shop A' });
  shopB = await loginAsOwner(app, { username: 'shopb', shopName: 'Shop B' });
});

afterEach(async () => {
  await Invoice.deleteMany({});
  await Customer.deleteMany({});
  await Product.deleteMany({});
  await mongoose.connection.collection('users').deleteMany({});
  await Shop.deleteMany({});
  await mongoose.connection.collection('counters').deleteMany({});
});

describe('GET /api/ai/reports/:reportId', () => {
  test('requires authentication', async () => {
    await createFinalizedInvoice(shopA, { price: 100 });
    const { reportId } = await generateReport({ reportType: 'sales', shopId: shopA.shopId });

    const res = await request(app).get(`/api/ai/reports/${reportId}`);
    expect(res.status).toBe(401);
  });

  test('the owning shop can download its own report as a real PDF', async () => {
    await createFinalizedInvoice(shopA, { price: 100 });
    const { reportId, filename } = await generateReport({ reportType: 'sales', shopId: shopA.shopId });

    const res = await shopA.get(`/api/ai/reports/${reportId}`).buffer(true).parse((response, cb) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => cb(null, Buffer.concat(chunks)));
    });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain(filename);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
  });

  test('a different shop cannot download another shop\'s report', async () => {
    await createFinalizedInvoice(shopA, { price: 100 });
    const { reportId } = await generateReport({ reportType: 'sales', shopId: shopA.shopId });

    const res = await shopB.get(`/api/ai/reports/${reportId}`);
    expect(res.status).toBe(404);
  });

  test('a malformed reportId is rejected before any lookup happens', async () => {
    const res = await shopA.get('/api/ai/reports/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('a well-formed but nonexistent reportId returns 404', async () => {
    const res = await shopA.get('/api/ai/reports/3fa85f64-5717-4562-b3fc-2c963f66afa6');
    expect(res.status).toBe(404);
  });

  test('no internal path or stack trace ever appears in any response', async () => {
    const responses = await Promise.all([
      shopA.get('/api/ai/reports/not-a-uuid'),
      shopA.get('/api/ai/reports/3fa85f64-5717-4562-b3fc-2c963f66afa6'),
    ]);

    for (const res of responses) {
      const raw = JSON.stringify(res.body);
      expect(raw).not.toMatch(/\/home\/|\/services\/|\.js:\d+:\d+|node_modules/);
    }
  });
});
