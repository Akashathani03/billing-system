import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import { loginAsOwner } from './helpers/testAuth.js';
import { createFinalizedInvoice } from './helpers/invoiceHelpers.js';
import { getBusinessDayRangeUTC } from '../utils/businessDate.js';

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

async function setFinalizedAt(invoiceId, date) {
  await Invoice.findByIdAndUpdate(invoiceId, { finalizedAt: date });
}

describe('GET /api/dashboard/summary', () => {
  test('A: requires authentication', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    expect(res.status).toBe(401);
  });

  test('R: handles zero invoices without crashing', async () => {
    const res = await agent.get('/api/dashboard/summary');
    expect(res.status).toBe(200);
    expect(res.body.today).toEqual({ sales: 0, bills: 0, paid: 0, pending: 0 });
    expect(res.body.paymentBreakdown).toEqual({ cash: 0, upi: 0, card: 0, credit: 0 });
    expect(res.body.recentBills).toEqual([]);
    expect(res.body.salesTrend).toHaveLength(7);
    expect(res.body.salesTrend.every((d) => d.total === 0)).toBe(true);
  });

  test('B/C/D/E/F/G/H/I/J: sales, bills, paid, pending, breakdown all reconcile', async () => {
    // A: 100 -> total 118, cash, paid
    const a = await createFinalizedInvoice(agent, { price: 100, paymentMethod: 'cash', paymentStatus: 'paid', customerMobile: '9111111111' });
    // B: 200 -> total 236, upi, paid
    const b = await createFinalizedInvoice(agent, { price: 200, paymentMethod: 'upi', paymentStatus: 'paid', customerMobile: '9222222222' });
    // C: 300 -> total 354, credit, PENDING
    const c = await createFinalizedInvoice(agent, { price: 300, paymentMethod: 'credit', paymentStatus: 'pending', customerMobile: '9333333333' });
    // D: 400 -> total 472, card, paid
    const d = await createFinalizedInvoice(agent, { price: 400, paymentMethod: 'card', paymentStatus: 'paid', customerMobile: '9444444444' });

    const res = await agent.get('/api/dashboard/summary');
    expect(res.status).toBe(200);

    const expectedSales = 118 + 236 + 354 + 472; // 1180
    const expectedPending = 354; // invoice C only
    const expectedPaid = expectedSales - expectedPending;

    expect(res.body.today.sales).toBe(expectedSales);
    expect(res.body.today.bills).toBe(4);
    expect(res.body.today.paid).toBe(expectedPaid); // H/I/J: pending credit excluded from paid
    expect(res.body.today.pending).toBe(expectedPending); // H/I: pending credit counted here

    expect(res.body.paymentBreakdown).toEqual({ cash: 118, upi: 236, card: 472, credit: 354 });

    // G: reconciliation
    const breakdownSum = Object.values(res.body.paymentBreakdown).reduce((s, v) => s + v, 0);
    expect(breakdownSum).toBe(res.body.today.sales);
    expect(res.body.today.paid + res.body.today.pending).toBe(res.body.today.sales);

    void a;
    void b;
    void d;
  });

  test('K: a cancelled invoice is excluded from every dashboard figure', async () => {
    await createFinalizedInvoice(agent, { price: 100, paymentMethod: 'cash', paymentStatus: 'paid', customerMobile: '9111111111' });
    const { invoice: cancelled } = await createFinalizedInvoice(agent, {
      price: 500,
      paymentMethod: 'credit',
      paymentStatus: 'pending',
      customerMobile: '9222222222',
    });
    await Invoice.findByIdAndUpdate(cancelled._id, { status: 'cancelled' });

    const res = await agent.get('/api/dashboard/summary');
    expect(res.body.today.sales).toBe(118); // only the cash invoice
    expect(res.body.today.bills).toBe(1);
    expect(res.body.today.pending).toBe(0);
    expect(res.body.paymentBreakdown.credit).toBe(0);
    expect(res.body.recentBills.some((inv) => inv.invoiceNumber === cancelled.invoiceNumber)).toBe(false);
  });

  test('L: a draft invoice is excluded from every dashboard figure', async () => {
    const customer = await Customer.create({ name: 'X', mobile: '9000000000' });
    const product = await Product.create({ name: 'Y', price: 100 });
    await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });

    const res = await agent.get('/api/dashboard/summary');
    expect(res.body.today).toEqual({ sales: 0, bills: 0, paid: 0, pending: 0 });
    expect(res.body.recentBills).toEqual([]);
  });

  test('P/Q: recent bills are finalized-only, newest first, capped at 5', async () => {
    const finalized = [];
    for (let i = 0; i < 6; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const { invoice } = await createFinalizedInvoice(agent, { customerMobile: `900000000${i}` });
      // eslint-disable-next-line no-await-in-loop
      await setFinalizedAt(invoice._id, new Date(Date.now() - (6 - i) * 60 * 1000));
      finalized.push(invoice);
    }
    const customer = await Customer.create({ name: 'Draft Only', mobile: '9999999999' });
    const product = await Product.create({ name: 'Z', price: 50 });
    await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });

    const res = await agent.get('/api/dashboard/summary');
    expect(res.body.recentBills).toHaveLength(5);

    const numbers = res.body.recentBills.map((inv) => inv.invoiceNumber);
    const sortedDesc = [...numbers].sort().reverse();
    expect(numbers).toEqual(sortedDesc);
  });

  test('N/O: an invoice 1ms before today\'s IST boundary does not count as today; 1ms after does', async () => {
    const { start } = getBusinessDayRangeUTC();

    const { invoice: justBefore } = await createFinalizedInvoice(agent, { price: 100, customerMobile: '9111111111' });
    await setFinalizedAt(justBefore._id, new Date(start.getTime() - 1));

    const { invoice: justAfter } = await createFinalizedInvoice(agent, { price: 200, customerMobile: '9222222222' });
    await setFinalizedAt(justAfter._id, new Date(start.getTime()));

    const res = await agent.get('/api/dashboard/summary');
    expect(res.body.today.sales).toBe(236); // only the 200-rupee (->236) invoice counts as today
    expect(res.body.today.bills).toBe(1);
  });

  test('M: 7-day sales trend has 7 chronological entries with correct per-day sums', async () => {
    const { start: todayStart } = getBusinessDayRangeUTC();

    const { invoice: today } = await createFinalizedInvoice(agent, { price: 100, customerMobile: '9111111111' }); // 118
    await setFinalizedAt(today._id, new Date(todayStart.getTime() + 60 * 1000));

    const threeDaysAgoStart = new Date(todayStart.getTime() - 3 * 24 * 60 * 60 * 1000);
    const { invoice: threeDaysAgo } = await createFinalizedInvoice(agent, { price: 200, customerMobile: '9222222222' }); // 236
    await setFinalizedAt(threeDaysAgo._id, new Date(threeDaysAgoStart.getTime() + 60 * 1000));

    const res = await agent.get('/api/dashboard/summary');
    expect(res.body.salesTrend).toHaveLength(7);

    const dates = res.body.salesTrend.map((d) => d.date);
    const sortedAsc = [...dates].sort();
    expect(dates).toEqual(sortedAsc); // chronological, oldest first

    const lastDay = res.body.salesTrend[6];
    expect(lastDay.total).toBe(118);

    const dayMinus3 = res.body.salesTrend[3];
    expect(dayMinus3.total).toBe(236);

    const untouchedDay = res.body.salesTrend[1];
    expect(untouchedDay.total).toBe(0);
  });
});
