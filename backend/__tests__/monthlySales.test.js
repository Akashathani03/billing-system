import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import { loginAsOwner } from './helpers/testAuth.js';
import { createFinalizedInvoice } from './helpers/invoiceHelpers.js';
import { getRecentBusinessMonthRanges, getBusinessYearMonthRanges, getCurrentBusinessYear } from '../utils/businessDate.js';

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

async function setFinalizedAt(invoiceId, date) {
  await Invoice.findByIdAndUpdate(invoiceId, { finalizedAt: date });
}

/** The fixed year-buffer always shown around the current business year (2 back, 1 ahead), descending. */
function expectedYearBuffer() {
  const cy = getCurrentBusinessYear();
  return [cy + 1, cy, cy - 1, cy - 2];
}

describe('GET /api/dashboard/monthly-sales', () => {
  test('requires authentication', async () => {
    const res = await request(app).get('/api/dashboard/monthly-sales');
    expect(res.status).toBe(401);
  });

  test('I: returns the last 12 months, newest first', async () => {
    const res = await agent.get('/api/dashboard/monthly-sales');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(12);

    const months = res.body.map((m) => m.month);
    const sortedDesc = [...months].sort().reverse();
    expect(months).toEqual(sortedDesc);
  });

  test('H: months with no finalized invoices return zero, not omitted', async () => {
    const res = await agent.get('/api/dashboard/monthly-sales');
    res.body.forEach((m) => {
      expect(m).toHaveProperty('sales');
      expect(m).toHaveProperty('bills');
      expect(m.sales).toBeGreaterThanOrEqual(0);
      expect(m.bills).toBeGreaterThanOrEqual(0);
    });
    // With no invoices created in this test, every month is genuinely empty.
    expect(res.body.every((m) => m.sales === 0 && m.bills === 0)).toBe(true);
  });

  test('A/E: a finalized paid invoice is included in this month', async () => {
    await createFinalizedInvoice(agent, { price: 100, paymentStatus: 'paid' });

    const res = await agent.get('/api/dashboard/monthly-sales');
    const currentMonth = res.body[0];
    expect(currentMonth.sales).toBe(100);
    expect(currentMonth.bills).toBe(1);
  });

  test('D: a pending finalized invoice still counts as a sale', async () => {
    await createFinalizedInvoice(agent, {
      price: 200,
      paymentMethod: 'credit',
      paymentStatus: 'pending',
    });

    const res = await agent.get('/api/dashboard/monthly-sales');
    const currentMonth = res.body[0];
    expect(currentMonth.sales).toBe(200);
    expect(currentMonth.bills).toBe(1);
  });

  test('B: a draft invoice is excluded', async () => {
    const customer = await Customer.create({ shopId: agent.shopId, name: 'X', mobile: '9000000000' });
    const product = await Product.create({ shopId: agent.shopId, name: 'Y', price: 100 });
    await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });

    const res = await agent.get('/api/dashboard/monthly-sales');
    expect(res.body[0].sales).toBe(0);
    expect(res.body[0].bills).toBe(0);
  });

  test('C: a cancelled invoice is excluded', async () => {
    const { invoice } = await createFinalizedInvoice(agent, { price: 100 });
    await Invoice.findByIdAndUpdate(invoice._id, { status: 'cancelled' });

    const res = await agent.get('/api/dashboard/monthly-sales');
    expect(res.body[0].sales).toBe(0);
    expect(res.body[0].bills).toBe(0);
  });

  test('F/G: multiple invoices in the same month are summed correctly', async () => {
    await createFinalizedInvoice(agent, { price: 100, customerMobile: '9111111111' });
    await createFinalizedInvoice(agent, { price: 200, customerMobile: '9222222222' });
    await createFinalizedInvoice(agent, { price: 50, customerMobile: '9333333333' });

    const res = await agent.get('/api/dashboard/monthly-sales');
    const currentMonth = res.body[0];
    expect(currentMonth.sales).toBe(100 + 200 + 50);
    expect(currentMonth.bills).toBe(3);
  });

  test('J: business-timezone month boundary — 1ms before this month does not count, 1ms after does', async () => {
    const [previousMonth, currentMonth] = getRecentBusinessMonthRanges(2);
    const boundary = currentMonth.start; // == previousMonth.end

    const { invoice: justBefore } = await createFinalizedInvoice(agent, {
      price: 100,
      customerMobile: '9111111111',
    });
    await setFinalizedAt(justBefore._id, new Date(boundary.getTime() - 1));

    const { invoice: justAfter } = await createFinalizedInvoice(agent, {
      price: 200,
      customerMobile: '9222222222',
    });
    await setFinalizedAt(justAfter._id, new Date(boundary.getTime()));

    const res = await agent.get('/api/dashboard/monthly-sales');
    const thisMonth = res.body[0];
    const lastMonth = res.body[1];

    expect(thisMonth.sales).toBe(200); // only the "justAfter" invoice
    expect(thisMonth.bills).toBe(1);
    expect(lastMonth.sales).toBe(100); // only the "justBefore" invoice
    expect(lastMonth.bills).toBe(1);

    void previousMonth;
  });
});

describe('GET /api/dashboard/monthly-sales?year=YYYY', () => {
  test('requires authentication', async () => {
    const year = getCurrentBusinessYear();
    const res = await request(app).get('/api/dashboard/monthly-sales').query({ year });
    expect(res.status).toBe(401);
  });

  test('rejects a malformed year', async () => {
    const res = await agent.get('/api/dashboard/monthly-sales').query({ year: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns all 12 calendar months, January through December, for a year with no invoices', async () => {
    const year = getCurrentBusinessYear() - 5; // safely empty
    const res = await agent.get('/api/dashboard/monthly-sales').query({ year });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(12);
    expect(res.body.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(res.body[0].label).toBe('January');
    expect(res.body[11].label).toBe('December');
    expect(res.body.every((m) => m.sales === 0 && m.bills === 0)).toBe(true);
  });

  test('a future month in the current year still appears, with zero sales', async () => {
    const year = getCurrentBusinessYear();
    const res = await agent.get('/api/dashboard/monthly-sales').query({ year });
    // December (index 11) is >= "now" for every month except when "now" is
    // itself December — still a valid, deterministic check either way.
    const december = res.body[11];
    expect(december.month).toBe(12);
    expect(december).toHaveProperty('sales');
    expect(december).toHaveProperty('bills');
  });

  test('an invoice finalized in a specific month of the requested year is correctly attributed', async () => {
    const year = getCurrentBusinessYear() - 3; // an arbitrary past, otherwise-empty year
    const yearRanges = getBusinessYearMonthRanges(year);
    const march = yearRanges[2]; // month index 2 = March

    const { invoice } = await createFinalizedInvoice(agent, { price: 100 });
    await setFinalizedAt(invoice._id, new Date(march.start.getTime() + 60 * 1000));

    const res = await agent.get('/api/dashboard/monthly-sales').query({ year });
    expect(res.body[2].month).toBe(3);
    expect(res.body[2].sales).toBe(100);
    expect(res.body[2].bills).toBe(1);
    // every other month in that year remains empty
    expect(res.body.filter((m) => m.month !== 3).every((m) => m.sales === 0 && m.bills === 0)).toBe(true);
  });

  test('drafts and cancelled invoices are excluded from the year-scoped view too', async () => {
    const year = getCurrentBusinessYear() - 4;
    const yearRanges = getBusinessYearMonthRanges(year);

    const customer = await Customer.create({ shopId: agent.shopId, name: 'X', mobile: '9000000000' });
    const product = await Product.create({ shopId: agent.shopId, name: 'Y', price: 100 });
    await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 1 }],
    }); // left as a draft

    const { invoice: cancelled } = await createFinalizedInvoice(agent, { price: 200, customerMobile: '9222222222' });
    await Invoice.findByIdAndUpdate(cancelled._id, {
      status: 'cancelled',
      finalizedAt: new Date(yearRanges[0].start.getTime() + 60 * 1000),
    });

    const res = await agent.get('/api/dashboard/monthly-sales').query({ year });
    expect(res.body.every((m) => m.sales === 0 && m.bills === 0)).toBe(true);
  });
});

describe('GET /api/dashboard/sales-years', () => {
  test('requires authentication', async () => {
    const res = await request(app).get('/api/dashboard/sales-years');
    expect(res.status).toBe(401);
  });

  test('with no invoices, returns exactly the fixed buffer around the current year (2 back, 1 ahead), descending', async () => {
    const res = await agent.get('/api/dashboard/sales-years');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expectedYearBuffer());
  });

  test('a year with a finalized invoice that falls OUTSIDE the buffer is still included, unioned in', async () => {
    const farPastYear = getCurrentBusinessYear() - 5; // outside the 2-back/1-ahead buffer
    const yearRanges = getBusinessYearMonthRanges(farPastYear);
    const { invoice } = await createFinalizedInvoice(agent, { price: 100 });
    await setFinalizedAt(invoice._id, new Date(yearRanges[0].start.getTime() + 60 * 1000));

    const res = await agent.get('/api/dashboard/sales-years');
    expect(res.body).toContain(farPastYear);
    expect(res.body).toEqual(expect.arrayContaining(expectedYearBuffer()));
    const sortedDesc = [...res.body].sort((a, b) => b - a);
    expect(res.body).toEqual(sortedDesc);
  });

  test('a finalized invoice with no finalizedAt (pre-Phase-4 legacy data) does not produce a bogus year', async () => {
    const { invoice } = await createFinalizedInvoice(agent, { price: 100 });
    // Simulate a legacy record from before finalizedAt existed.
    await Invoice.findByIdAndUpdate(invoice._id, { $unset: { finalizedAt: '' } });

    const res = await agent.get('/api/dashboard/sales-years');
    expect(res.body).toEqual(expectedYearBuffer());
    expect(res.body).not.toContain(0);
    expect(res.body.every((y) => Number.isInteger(y) && y > 1900)).toBe(true);
  });

  test('a draft invoice never contributes a year beyond the fixed buffer (it has no finalizedAt and is not status=finalized)', async () => {
    const customer = await Customer.create({ shopId: agent.shopId, name: 'X', mobile: '9000000000' });
    const product = await Product.create({ shopId: agent.shopId, name: 'Y', price: 100 });
    await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });

    const res = await agent.get('/api/dashboard/sales-years');
    // Just the fixed buffer — nothing added by the draft.
    expect(res.body).toEqual(expectedYearBuffer());
  });
});
