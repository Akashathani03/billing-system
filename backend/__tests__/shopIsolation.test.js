import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import Invoice from '../models/Invoice.js';
import ManualBillPhoto from '../models/ManualBillPhoto.js';
import Shop from '../models/Shop.js';
import User from '../models/User.js';
import * as objectStorage from '../services/objectStorage.service.js';
import { loginAsOwner } from './helpers/testAuth.js';
import { createFinalizedInvoice } from './helpers/invoiceHelpers.js';

let mongod;
let shopA;
let shopB;

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

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
  shopA = await loginAsOwner(app, { username: 'shopa', shopName: 'Shop A' });
  shopB = await loginAsOwner(app, { username: 'shopb', shopName: 'Shop B' });
});

afterEach(async () => {
  objectStorage._testOnlyClear();
  await Invoice.deleteMany({});
  await Customer.deleteMany({});
  await Product.deleteMany({});
  await ManualBillPhoto.deleteMany({});
  await User.deleteMany({});
  await Shop.deleteMany({});
  await mongoose.connection.collection('counters').deleteMany({});
});

/**
 * Two independent shops (A and B), each with their own logged-in agent, per
 * test — shopB's data must be completely invisible and unmodifiable through
 * shopA's session, regardless of what IDs shopA's requests reference.
 *
 * Customer and Product have no hard-delete endpoint at all (only PATCH,
 * including Product's isActive soft-delete) — the "cannot modify" tests
 * below already cover every mutation path that exists for them. Invoice
 * only supports hard-delete while still a draft, which is tested directly.
 */
describe('cross-shop data isolation', () => {
  test("a shop cannot list another shop's customers", async () => {
    await Customer.create({ shopId: shopB.shopId, name: 'B Customer', mobile: '9000000001' });
    const res = await shopA.get('/api/customers');
    expect(res.body.customers).toHaveLength(0);
  });

  test("a shop cannot read another shop's customer by id", async () => {
    const bCustomer = await Customer.create({ shopId: shopB.shopId, name: 'B Customer', mobile: '9000000001' });
    const res = await shopA.get(`/api/customers/${bCustomer._id}`);
    expect(res.status).toBe(404);
  });

  test("a shop cannot modify another shop's customer", async () => {
    const bCustomer = await Customer.create({ shopId: shopB.shopId, name: 'B Customer', mobile: '9000000001' });
    const res = await shopA.patch(`/api/customers/${bCustomer._id}`).send({ name: 'Hacked' });
    expect(res.status).toBe(404);
    const stillThere = await Customer.findById(bCustomer._id);
    expect(stillThere.name).toBe('B Customer');
  });

  test("a shop cannot list another shop's products", async () => {
    await Product.create({ shopId: shopB.shopId, name: 'B Product', price: 100 });
    const res = await shopA.get('/api/products');
    expect(res.body.products).toHaveLength(0);
  });

  test("a shop cannot read another shop's product by id", async () => {
    const bProduct = await Product.create({ shopId: shopB.shopId, name: 'B Product', price: 100 });
    const res = await shopA.get(`/api/products/${bProduct._id}`);
    expect(res.status).toBe(404);
  });

  test("a shop cannot modify another shop's product", async () => {
    const bProduct = await Product.create({ shopId: shopB.shopId, name: 'B Product', price: 100 });
    const res = await shopA.patch(`/api/products/${bProduct._id}`).send({ price: 1 });
    expect(res.status).toBe(404);
    const stillThere = await Product.findById(bProduct._id);
    expect(stillThere.price).toBe(100);
  });

  test("a shop cannot deactivate (soft-delete) another shop's product", async () => {
    const bProduct = await Product.create({ shopId: shopB.shopId, name: 'B Product', price: 100 });
    const res = await shopA.patch(`/api/products/${bProduct._id}`).send({ isActive: false });
    expect(res.status).toBe(404);
    const stillThere = await Product.findById(bProduct._id);
    expect(stillThere.isActive).toBe(true);
  });

  test("a shop cannot list another shop's invoices", async () => {
    await createFinalizedInvoice(shopB);
    const res = await shopA.get('/api/invoices').query({ status: 'finalized' });
    expect(res.body.invoices).toHaveLength(0);
  });

  test("a shop cannot read another shop's invoice by id", async () => {
    const { invoice } = await createFinalizedInvoice(shopB);
    const res = await shopA.get(`/api/invoices/${invoice._id}`);
    expect(res.status).toBe(404);
  });

  test("a shop cannot download another shop's invoice PDF", async () => {
    const { invoice } = await createFinalizedInvoice(shopB);
    const res = await shopA.get(`/api/invoices/${invoice._id}/pdf`);
    expect(res.status).toBe(404);
  });

  test("a shop cannot delete another shop's draft invoice", async () => {
    const bCustomer = await Customer.create({ shopId: shopB.shopId, name: 'X', mobile: '9000000002' });
    const draftRes = await shopB.post('/api/invoices').send({ customerId: bCustomer._id.toString(), items: [] });

    const res = await shopA.delete(`/api/invoices/${draftRes.body.invoice._id}`);
    expect(res.status).toBe(404);
    const stillThere = await Invoice.findById(draftRes.body.invoice._id);
    expect(stillThere).not.toBeNull();
  });

  test("a shop cannot update another shop's draft invoice", async () => {
    const bCustomer = await Customer.create({ shopId: shopB.shopId, name: 'X', mobile: '9000000009' });
    const draftRes = await shopB.post('/api/invoices').send({ customerId: bCustomer._id.toString(), items: [] });

    const res = await shopA.patch(`/api/invoices/${draftRes.body.invoice._id}`).send({ paymentMethod: 'upi' });
    expect(res.status).toBe(404);
  });

  test("a shop cannot finalize another shop's draft invoice", async () => {
    const bCustomer = await Customer.create({ shopId: shopB.shopId, name: 'X', mobile: '9000000010' });
    const bProduct = await Product.create({ shopId: shopB.shopId, name: 'Y', price: 100 });
    const draftRes = await shopB.post('/api/invoices').send({
      customerId: bCustomer._id.toString(),
      items: [{ productId: bProduct._id.toString(), quantity: 1 }],
    });

    const res = await shopA.post(`/api/invoices/${draftRes.body.invoice._id}/finalize`);
    expect(res.status).toBe(404);
  });

  test("a shop cannot mark another shop's invoice payment status", async () => {
    const { invoice } = await createFinalizedInvoice(shopB, { paymentStatus: 'pending', paymentMethod: 'credit' });
    const res = await shopA.patch(`/api/invoices/${invoice._id}/payment-status`).send({ paymentStatus: 'paid' });
    expect(res.status).toBe(404);
  });

  test("a shop cannot create an invoice using another shop's customer", async () => {
    const bCustomer = await Customer.create({ shopId: shopB.shopId, name: 'B Customer', mobile: '9000000003' });
    const aProduct = await Product.create({ shopId: shopA.shopId, name: 'A Product', price: 100 });

    const res = await shopA.post('/api/invoices').send({
      customerId: bCustomer._id.toString(),
      items: [{ productId: aProduct._id.toString(), quantity: 1 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CUSTOMER');
  });

  test("a shop cannot create an invoice using another shop's product", async () => {
    const aCustomer = await Customer.create({ shopId: shopA.shopId, name: 'A Customer', mobile: '9000000004' });
    const bProduct = await Product.create({ shopId: shopB.shopId, name: 'B Product', price: 100 });

    const res = await shopA.post('/api/invoices').send({
      customerId: aCustomer._id.toString(),
      items: [{ productId: bProduct._id.toString(), quantity: 1 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PRODUCT');
  });

  test("a shop's dashboard summary never includes another shop's sales", async () => {
    await createFinalizedInvoice(shopB, { price: 1000 });
    const res = await shopA.get('/api/dashboard/summary');
    expect(res.body.today).toEqual({ sales: 0, bills: 0, paid: 0, pending: 0 });
    expect(res.body.recentBills).toEqual([]);
  });

  test("a shop's monthly sales never includes another shop's sales", async () => {
    await createFinalizedInvoice(shopB, { price: 1000 });
    const res = await shopA.get('/api/dashboard/monthly-sales');
    expect(res.body[0].sales).toBe(0);
    expect(res.body[0].bills).toBe(0);
  });

  test("a shop's available sales-years never grows from another shop's activity outside its own buffer", async () => {
    await createFinalizedInvoice(shopA);
    const beforeB = await shopA.get('/api/dashboard/sales-years');
    await createFinalizedInvoice(shopB);
    const afterB = await shopA.get('/api/dashboard/sales-years');
    expect(afterB.body).toEqual(beforeB.body);
  });

  test("a shop cannot list another shop's manual bill photos", async () => {
    const bCustomer = await Customer.create({ shopId: shopB.shopId, name: 'B Customer', mobile: '9000000005' });
    await shopB
      .post('/api/manual-bills')
      .field('customerId', bCustomer._id.toString())
      .attach('photo', JPEG_BYTES, { filename: 'bill.jpg', contentType: 'image/jpeg' });

    const res = await shopA.get('/api/manual-bills').query({ customerId: bCustomer._id.toString() });
    expect(res.status).toBe(200);
    expect(res.body.photos).toHaveLength(0);
  });

  test("a shop cannot view another shop's manual bill photo image", async () => {
    const bCustomer = await Customer.create({ shopId: shopB.shopId, name: 'B Customer', mobile: '9000000006' });
    const uploaded = await shopB
      .post('/api/manual-bills')
      .field('customerId', bCustomer._id.toString())
      .attach('photo', JPEG_BYTES, { filename: 'bill.jpg', contentType: 'image/jpeg' });

    const res = await shopA.get(`/api/manual-bills/${uploaded.body.photo._id}/image`);
    expect(res.status).toBe(404);
  });

  test("a shop cannot delete another shop's manual bill photo", async () => {
    const bCustomer = await Customer.create({ shopId: shopB.shopId, name: 'B Customer', mobile: '9000000007' });
    const uploaded = await shopB
      .post('/api/manual-bills')
      .field('customerId', bCustomer._id.toString())
      .attach('photo', JPEG_BYTES, { filename: 'bill.jpg', contentType: 'image/jpeg' });

    const res = await shopA.delete(`/api/manual-bills/${uploaded.body.photo._id}`);
    expect(res.status).toBe(404);
    const stillThere = await ManualBillPhoto.findById(uploaded.body.photo._id);
    expect(stillThere).not.toBeNull();
  });

  test("a shop cannot attach a manual bill photo to another shop's customer", async () => {
    const bCustomer = await Customer.create({ shopId: shopB.shopId, name: 'B Customer', mobile: '9000000008' });
    const res = await shopA
      .post('/api/manual-bills')
      .field('customerId', bCustomer._id.toString())
      .attach('photo', JPEG_BYTES, { filename: 'bill.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CUSTOMER_NOT_FOUND');
  });

  test('invoice numbers are independent per shop — both can have INV-<year>-0001', async () => {
    const aInvoice = await createFinalizedInvoice(shopA, { customerMobile: '9111111111' });
    const bInvoice = await createFinalizedInvoice(shopB, { customerMobile: '9222222222' });
    expect(aInvoice.invoice.invoiceNumber).toBe(bInvoice.invoice.invoiceNumber);
  });
});
