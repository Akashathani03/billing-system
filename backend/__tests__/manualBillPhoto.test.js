import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import Customer from '../models/Customer.js';
import ManualBillPhoto from '../models/ManualBillPhoto.js';
import * as objectStorage from '../services/objectStorage.service.js';
import { loginAsOwner } from './helpers/testAuth.js';

let mongod;
let agent;

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

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
  objectStorage._testOnlyClear();
  await ManualBillPhoto.deleteMany({});
  await Customer.deleteMany({});
  await mongoose.connection.collection('users').deleteMany({});
});

async function createCustomer() {
  return Customer.create({ shopId: agent.shopId, name: 'Ramesh Kumar', mobile: '9876543210' });
}

describe('POST /api/manual-bills', () => {
  test('requires authentication', async () => {
    const customer = await createCustomer();
    const res = await request(app)
      .post('/api/manual-bills')
      .field('customerId', customer._id.toString())
      .attach('photo', JPEG_BYTES, { filename: 'bill.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(401);
  });

  test('uploads and associates a photo with the given customer', async () => {
    const customer = await createCustomer();
    const res = await agent
      .post('/api/manual-bills')
      .field('customerId', customer._id.toString())
      .attach('photo', JPEG_BYTES, { filename: 'bill.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.photo.customerId).toBe(customer._id.toString());
    expect(res.body.photo.createdAt).toBeTruthy();

    const stored = await ManualBillPhoto.findById(res.body.photo._id);
    expect(stored.mimeType).toBe('image/jpeg');
    expect(stored.storageKey).toBeTruthy();
    expect(objectStorage._testOnlyObjectCount()).toBe(1);
  });

  test('rejects a missing file', async () => {
    const customer = await createCustomer();
    const res = await agent.post('/api/manual-bills').field('customerId', customer._id.toString());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FILE_REQUIRED');
  });

  test('rejects a non-image file type and uploads nothing to storage', async () => {
    const customer = await createCustomer();
    const res = await agent
      .post('/api/manual-bills')
      .field('customerId', customer._id.toString())
      .attach('photo', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
    expect(await ManualBillPhoto.countDocuments({})).toBe(0);
    expect(objectStorage._testOnlyObjectCount()).toBe(0);
  });

  test('rejects a file over the size limit', async () => {
    const customer = await createCustomer();
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
    const res = await agent
      .post('/api/manual-bills')
      .field('customerId', customer._id.toString())
      .attach('photo', oversized, { filename: 'huge.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    expect(await ManualBillPhoto.countDocuments({})).toBe(0);
    expect(objectStorage._testOnlyObjectCount()).toBe(0);
  });

  test('rejects an unknown customerId and uploads nothing to storage', async () => {
    const res = await agent
      .post('/api/manual-bills')
      .field('customerId', new mongoose.Types.ObjectId().toString())
      .attach('photo', JPEG_BYTES, { filename: 'bill.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CUSTOMER_NOT_FOUND');
    expect(objectStorage._testOnlyObjectCount()).toBe(0);
  });

  test('rejects a malformed customerId', async () => {
    const res = await agent
      .post('/api/manual-bills')
      .field('customerId', 'not-an-id')
      .attach('photo', JPEG_BYTES, { filename: 'bill.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CUSTOMER');
  });

  test('cleans up the uploaded object if the database write fails after a successful upload', async () => {
    const customer = await createCustomer();
    const createSpy = jest.spyOn(ManualBillPhoto, 'create').mockRejectedValueOnce(new Error('simulated db failure'));

    const res = await agent
      .post('/api/manual-bills')
      .field('customerId', customer._id.toString())
      .attach('photo', JPEG_BYTES, { filename: 'bill.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(500);
    expect(await ManualBillPhoto.countDocuments({})).toBe(0);
    expect(objectStorage._testOnlyObjectCount()).toBe(0);

    createSpy.mockRestore();
  });
});

describe('GET /api/manual-bills', () => {
  test('requires authentication', async () => {
    const customer = await createCustomer();
    const res = await request(app).get('/api/manual-bills').query({ customerId: customer._id.toString() });
    expect(res.status).toBe(401);
  });

  test('lists only photos belonging to the given customer, newest first', async () => {
    const customerA = await createCustomer();
    const customerB = await Customer.create({ shopId: agent.shopId, name: 'Suresh', mobile: '9988776655' });

    await agent
      .post('/api/manual-bills')
      .field('customerId', customerA._id.toString())
      .attach('photo', JPEG_BYTES, { filename: 'a1.jpg', contentType: 'image/jpeg' });
    await agent
      .post('/api/manual-bills')
      .field('customerId', customerB._id.toString())
      .attach('photo', JPEG_BYTES, { filename: 'b1.jpg', contentType: 'image/jpeg' });
    const secondForA = await agent
      .post('/api/manual-bills')
      .field('customerId', customerA._id.toString())
      .attach('photo', JPEG_BYTES, { filename: 'a2.jpg', contentType: 'image/jpeg' });

    const res = await agent.get('/api/manual-bills').query({ customerId: customerA._id.toString() });
    expect(res.status).toBe(200);
    expect(res.body.photos).toHaveLength(2);
    expect(res.body.photos[0]._id).toBe(secondForA.body.photo._id);
    expect(res.body.photos.every((p) => p.customerId === customerA._id.toString())).toBe(true);
  });
});

describe('GET /api/manual-bills/:id/image', () => {
  test('requires authentication', async () => {
    const customer = await createCustomer();
    const uploaded = await agent
      .post('/api/manual-bills')
      .field('customerId', customer._id.toString())
      .attach('photo', JPEG_BYTES, { filename: 'bill.jpg', contentType: 'image/jpeg' });

    const res = await request(app).get(`/api/manual-bills/${uploaded.body.photo._id}/image`);
    expect(res.status).toBe(401);
  });

  test('streams the image bytes with the correct content type', async () => {
    const customer = await createCustomer();
    const uploaded = await agent
      .post('/api/manual-bills')
      .field('customerId', customer._id.toString())
      .attach('photo', JPEG_BYTES, { filename: 'bill.jpg', contentType: 'image/jpeg' });

    const res = await agent
      .get(`/api/manual-bills/${uploaded.body.photo._id}/image`)
      .buffer(true)
      .parse((response, cb) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.compare(res.body, JPEG_BYTES)).toBe(0);
  });

  test('returns 404 for a nonexistent photo', async () => {
    const res = await agent.get(`/api/manual-bills/${new mongoose.Types.ObjectId()}/image`);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/manual-bills/:id', () => {
  test('requires authentication', async () => {
    const customer = await createCustomer();
    const uploaded = await agent
      .post('/api/manual-bills')
      .field('customerId', customer._id.toString())
      .attach('photo', JPEG_BYTES, { filename: 'bill.jpg', contentType: 'image/jpeg' });

    const res = await request(app).delete(`/api/manual-bills/${uploaded.body.photo._id}`);
    expect(res.status).toBe(401);
  });

  test('deletes the DB record and the underlying object in storage', async () => {
    const customer = await createCustomer();
    const uploaded = await agent
      .post('/api/manual-bills')
      .field('customerId', customer._id.toString())
      .attach('photo', JPEG_BYTES, { filename: 'bill.jpg', contentType: 'image/jpeg' });

    expect(objectStorage._testOnlyObjectCount()).toBe(1);

    const res = await agent.delete(`/api/manual-bills/${uploaded.body.photo._id}`);
    expect(res.status).toBe(204);

    expect(await ManualBillPhoto.findById(uploaded.body.photo._id)).toBeNull();
    expect(objectStorage._testOnlyObjectCount()).toBe(0);
  });

  test('returns 404 for a nonexistent photo', async () => {
    const res = await agent.delete(`/api/manual-bills/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(404);
  });
});

describe('manual bill photos do not affect invoice/customer financial data', () => {
  test('customer invoice history totals are unaffected by manual bill photos', async () => {
    const customer = await createCustomer();
    await agent
      .post('/api/manual-bills')
      .field('customerId', customer._id.toString())
      .attach('photo', JPEG_BYTES, { filename: 'bill.jpg', contentType: 'image/jpeg' });
    await agent
      .post('/api/manual-bills')
      .field('customerId', customer._id.toString())
      .attach('photo', JPEG_BYTES, { filename: 'bill2.jpg', contentType: 'image/jpeg' });

    const history = await agent.get(`/api/customers/${customer._id}/invoices`);
    expect(history.status).toBe(200);
    expect(history.body.totalBills).toBe(0);
    expect(history.body.totalPurchaseValue).toBe(0);
    expect(history.body.invoices).toHaveLength(0);
  });
});
