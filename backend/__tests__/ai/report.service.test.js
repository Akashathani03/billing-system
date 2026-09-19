import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PDFParse } from 'pdf-parse';
import app from '../../app.js';
import Invoice from '../../models/Invoice.js';
import Customer from '../../models/Customer.js';
import Product from '../../models/Product.js';
import Shop from '../../models/Shop.js';
import { loginAsOwner } from '../helpers/testAuth.js';
import { createFinalizedInvoice } from '../helpers/invoiceHelpers.js';
import { generateReport, getReport, ReportError, _testOnlyClearReports } from '../../services/ai/report.service.js';

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

async function extractText(buffer) {
  return (await new PDFParse({ data: buffer }).getText()).text;
}

function assertLooksLikePdf(buffer) {
  expect(Buffer.isBuffer(buffer)).toBe(true);
  expect(buffer.length).toBeGreaterThan(200);
  expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
}

describe('generateReport', () => {
  test('1: a bills report is generated successfully and is a real PDF', async () => {
    await createFinalizedInvoice(shopA, { customerName: 'Ramesh', price: 150, paymentStatus: 'paid' });
    await createFinalizedInvoice(shopA, { customerName: 'Suresh', price: 90, customerMobile: '9000000002', paymentStatus: 'pending' });

    const { reportId, filename, reportType } = await generateReport({ reportType: 'bills', shopId: shopA.shopId });

    expect(reportType).toBe('bills');
    expect(filename).toMatch(/^billing-report-[a-zA-Z0-9-]+\.pdf$/);

    const stored = getReport(reportId, shopA.shopId);
    assertLooksLikePdf(stored.buffer);

    const text = await extractText(stored.buffer);
    expect(text).toContain('Billing Report');
    expect(text).toContain('Ramesh');
    expect(text).toContain('Suresh');
  });

  test('2: a payments report is generated successfully', async () => {
    await createFinalizedInvoice(shopA, { price: 100, paymentMethod: 'cash', paymentStatus: 'paid' });
    await createFinalizedInvoice(shopA, { price: 200, paymentMethod: 'upi', customerMobile: '9000000003', paymentStatus: 'paid' });

    const { reportId } = await generateReport({ reportType: 'payments', shopId: shopA.shopId });
    const stored = getReport(reportId, shopA.shopId);
    assertLooksLikePdf(stored.buffer);

    const text = await extractText(stored.buffer);
    expect(text).toContain('Payments Report');
    expect(text).toContain('Cash');
    expect(text).toContain('UPI');
  });

  test('3: a sales report is generated successfully', async () => {
    await createFinalizedInvoice(shopA, { price: 500 });

    const { reportId } = await generateReport({ reportType: 'sales', shopId: shopA.shopId });
    const stored = getReport(reportId, shopA.shopId);
    assertLooksLikePdf(stored.buffer);

    const text = await extractText(stored.buffer);
    expect(text).toContain('Sales Report');
  });

  test('4: a top-products report is generated successfully', async () => {
    await createFinalizedInvoice(shopA, { productName: 'LED Bulb 9W', price: 150 });

    const { reportId } = await generateReport({ reportType: 'top_products', shopId: shopA.shopId });
    const stored = getReport(reportId, shopA.shopId);
    assertLooksLikePdf(stored.buffer);

    const text = await extractText(stored.buffer);
    expect(text).toContain('Top Products Report');
    expect(text).toContain('LED Bulb 9W');
  });

  test('5: an outstanding-customers report is generated successfully', async () => {
    await createFinalizedInvoice(shopA, { customerName: 'Owes Money', price: 300, paymentStatus: 'pending' });

    const { reportId } = await generateReport({ reportType: 'outstanding_customers', shopId: shopA.shopId });
    const stored = getReport(reportId, shopA.shopId);
    assertLooksLikePdf(stored.buffer);

    const text = await extractText(stored.buffer);
    expect(text).toContain('Outstanding Customers Report');
    expect(text).toContain('Owes Money');
  });

  test('6: every generated report starts with valid PDF bytes and the correct content type', async () => {
    const { reportId } = await generateReport({ reportType: 'sales', shopId: shopA.shopId });
    const stored = getReport(reportId, shopA.shopId);

    assertLooksLikePdf(stored.buffer);
    expect(stored.contentType).toBe('application/pdf');
  });

  test('7: GST/tax never appears in a generated report', async () => {
    await createFinalizedInvoice(shopA, { price: 999 });

    for (const reportType of ['bills', 'payments', 'sales', 'top_products', 'outstanding_customers']) {
      // eslint-disable-next-line no-await-in-loop
      const { reportId } = await generateReport({ reportType, shopId: shopA.shopId });
      const stored = getReport(reportId, shopA.shopId);
      // eslint-disable-next-line no-await-in-loop
      const text = await extractText(stored.buffer);
      expect(text).not.toMatch(/gst|tax/i);
    }
  });

  test('8/9: reports are always scoped to the given shopId — another shop\'s data never appears', async () => {
    await createFinalizedInvoice(shopA, { customerName: 'ShopACustomer', price: 111 });
    await createFinalizedInvoice(shopB, { customerName: 'ShopBCustomer', price: 222, customerMobile: '9000000009' });

    const { reportId } = await generateReport({ reportType: 'bills', shopId: shopA.shopId });
    const stored = getReport(reportId, shopA.shopId);
    const text = await extractText(stored.buffer);

    expect(text).toContain('ShopACustomer');
    expect(text).not.toContain('ShopBCustomer');
  });

  test('9b: a report generated for shop A cannot be fetched using shop B\'s id', async () => {
    const { reportId } = await generateReport({ reportType: 'sales', shopId: shopA.shopId });

    expect(getReport(reportId, shopB.shopId)).toBeNull();
    expect(getReport(reportId, shopA.shopId)).not.toBeNull();
  });

  test('10: an invalid report type is rejected', async () => {
    await expect(generateReport({ reportType: 'delete_everything', shopId: shopA.shopId })).rejects.toThrow(ReportError);
  });

  test('12/13: the generated filename is always a safe, backend-built name — never a path', async () => {
    const { filename } = await generateReport({ reportType: 'bills', shopId: shopA.shopId, dateFrom: '2026-08-01', dateTo: '2026-08-31' });

    expect(filename).toBe('billing-report-2026-08.pdf');
    expect(filename).not.toMatch(/[/\\]/);
    expect(filename).not.toContain('..');
  });

  test('14: the bills report table is bounded even with far more matching bills than the display cap', async () => {
    const customer = await Customer.create({ shopId: shopA.shopId, name: 'Bulk Customer', mobile: '9000000099' });
    const product = await Product.create({ shopId: shopA.shopId, name: 'Widget', price: 10 });

    for (let i = 0; i < 60; i += 1) {
      const draft = await shopA.post('/api/invoices').send({
        customerId: customer._id.toString(),
        items: [{ productId: product._id.toString(), quantity: 1 }],
      });
      // eslint-disable-next-line no-await-in-loop
      await shopA.post(`/api/invoices/${draft.body.invoice._id}/finalize`);
    }

    const { reportId } = await generateReport({ reportType: 'bills', shopId: shopA.shopId });
    const stored = getReport(reportId, shopA.shopId);
    const text = await extractText(stored.buffer);

    expect(text).toMatch(/50 most recent of 60/);
  });

  test('14b: the outstanding-customers report is bounded to 50 rows', async () => {
    const product = await Product.create({ shopId: shopA.shopId, name: 'Widget', price: 10 });
    for (let i = 0; i < 55; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const customer = await Customer.create({ shopId: shopA.shopId, name: `Debtor ${i}`, mobile: `90000${String(i).padStart(5, '0')}` });
      // eslint-disable-next-line no-await-in-loop
      const draft = await shopA.post('/api/invoices').send({
        customerId: customer._id.toString(),
        items: [{ productId: product._id.toString(), quantity: 1 }],
        paymentStatus: 'pending',
      });
      // eslint-disable-next-line no-await-in-loop
      await shopA.post(`/api/invoices/${draft.body.invoice._id}/finalize`);
    }

    const { reportId } = await generateReport({ reportType: 'outstanding_customers', shopId: shopA.shopId });
    const stored = getReport(reportId, shopA.shopId);
    const text = await extractText(stored.buffer);

    expect(text).toMatch(/top 50 of 55/);
  });
});
