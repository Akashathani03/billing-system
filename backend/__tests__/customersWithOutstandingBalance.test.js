import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import { loginAsOwner } from './helpers/testAuth.js';
import { getCustomersWithOutstandingBalance } from '../services/invoice.service.js';

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
  await mongoose.connection.collection('shops').deleteMany({});
  await mongoose.connection.collection('counters').deleteMany({});
});

/**
 * Finalizes an invoice for an already-created customer/product. Unlike
 * helpers/invoiceHelpers.js's createFinalizedInvoice, this reuses a given
 * customer instead of always creating a fresh one — needed here because
 * several cases require the SAME customer to have more than one invoice.
 */
async function finalizeInvoiceFor(billingAgent, customer, product, { quantity = 1, paymentStatus = 'paid' } = {}) {
  const draftRes = await billingAgent.post('/api/invoices').send({
    customerId: customer._id.toString(),
    items: [{ productId: product._id.toString(), quantity }],
    paymentStatus,
  });
  const finalizeRes = await billingAgent.post(`/api/invoices/${draftRes.body.invoice._id}/finalize`);
  return finalizeRes.body.invoice;
}

describe('getCustomersWithOutstandingBalance', () => {
  test('a: a customer whose finalized invoices are all paid is excluded', async () => {
    const customer = await Customer.create({ shopId: agent.shopId, name: 'Ramesh', mobile: '9111111111' });
    const product = await Product.create({ shopId: agent.shopId, name: 'Widget', price: 100 });

    await finalizeInvoiceFor(agent, customer, product, { paymentStatus: 'paid' });

    const result = await getCustomersWithOutstandingBalance(agent.shopId);
    expect(result.find((c) => c.name === 'Ramesh')).toBeUndefined();
  });

  test('b/c: a customer with a pending finalized invoice is included, with the correct amounts', async () => {
    const customer = await Customer.create({ shopId: agent.shopId, name: 'Suresh', mobile: '9222222222' });
    const product = await Product.create({ shopId: agent.shopId, name: 'Widget', price: 100 });

    // One invoice already paid (100) and one still pending (250) — this
    // schema has no partial-payment field, only a per-invoice paid/pending
    // status, so "partially paid" at the customer level means exactly this:
    // some of their finalized invoices are paid and some are not.
    await finalizeInvoiceFor(agent, customer, product, { quantity: 1, paymentStatus: 'paid' });
    await finalizeInvoiceFor(agent, customer, product, { quantity: 2.5, paymentStatus: 'pending' });

    // A draft is never finalized and must not be counted.
    await agent.post('/api/invoices').send({
      customerId: customer._id.toString(),
      items: [{ productId: product._id.toString(), quantity: 100 }],
    });

    const result = await getCustomersWithOutstandingBalance(agent.shopId);
    const entry = result.find((c) => c.name === 'Suresh');

    expect(entry).toBeDefined();
    expect(entry.totalAmount).toBe(350);
    expect(entry.paidAmount).toBe(100);
    expect(entry.outstandingAmount).toBe(250);
  });

  test('d: another shop\'s customers and invoices never leak into the result', async () => {
    const customerA = await Customer.create({ shopId: agent.shopId, name: 'Ramesh', mobile: '9111111111' });
    const productA = await Product.create({ shopId: agent.shopId, name: 'Widget', price: 100 });
    await finalizeInvoiceFor(agent, customerA, productA, { paymentStatus: 'pending' });

    const otherAgent = await loginAsOwner(app, { username: 'shopb', shopName: 'Shop B' });
    const customerB = await Customer.create({ shopId: otherAgent.shopId, name: 'Mahesh', mobile: '9333333333' });
    const productB = await Product.create({ shopId: otherAgent.shopId, name: 'Gadget', price: 999 });
    await finalizeInvoiceFor(otherAgent, customerB, productB, { paymentStatus: 'pending' });

    const resultA = await getCustomersWithOutstandingBalance(agent.shopId);
    expect(resultA.some((c) => c.name === 'Mahesh')).toBe(false);
    expect(resultA.find((c) => c.name === 'Ramesh').outstandingAmount).toBe(100);

    const resultB = await getCustomersWithOutstandingBalance(otherAgent.shopId);
    expect(resultB.some((c) => c.name === 'Ramesh')).toBe(false);
    expect(resultB.find((c) => c.name === 'Mahesh').outstandingAmount).toBe(999);
  });
});
