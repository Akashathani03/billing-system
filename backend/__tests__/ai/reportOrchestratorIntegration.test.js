import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { jest } from '@jest/globals';

// Same ESM-mocking approach as orchestrator.test.js / knowledgeIntegration.test.js.
const generateContentMock = jest.fn();

jest.unstable_mockModule('../../services/ai/geminiClient.js', () => ({
  getGeminiClient: () => ({ models: { generateContent: generateContentMock } }),
  DEFAULT_GEMINI_MODEL: 'test-model',
}));

const { handleUserMessage } = await import('../../services/ai/orchestrator.service.js');
const app = (await import('../../app.js')).default;
const { default: Invoice } = await import('../../models/Invoice.js');
const { default: Customer } = await import('../../models/Customer.js');
const { default: Product } = await import('../../models/Product.js');
const { default: Shop } = await import('../../models/Shop.js');
const { loginAsOwner } = await import('../helpers/testAuth.js');
const { createFinalizedInvoice } = await import('../helpers/invoiceHelpers.js');
const { _testOnlyClearReports, getReport } = await import('../../services/ai/report.service.js');

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
  generateContentMock.mockReset();
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

function textResponse(text) {
  return { text, functionCalls: undefined };
}

function functionCallResponse(calls) {
  return {
    text: undefined,
    functionCalls: calls,
    candidates: [{ content: { role: 'model', parts: calls.map((call) => ({ functionCall: call })) } }],
  };
}

describe('orchestrator + generate_billing_report integration', () => {
  test('a report request returns a small structured result, never PDF bytes, to Gemini', async () => {
    await createFinalizedInvoice(shopA, { price: 150 });

    generateContentMock
      .mockResolvedValueOnce(functionCallResponse([{ name: 'generate_billing_report', args: { reportType: 'bills' } }]))
      .mockResolvedValueOnce(textResponse('Your billing report is ready: billing-report-2026-09.pdf'));

    const result = await handleUserMessage({ message: 'Make me a PDF of my bills', shopId: shopA.shopId });

    expect(result.reply).toBe('Your billing report is ready: billing-report-2026-09.pdf');

    const secondCallContents = generateContentMock.mock.calls[1][0].contents;
    const functionResponse = secondCallContents.at(-1).parts[0].functionResponse;
    const output = functionResponse.response.output;

    expect(output.success).toBe(true);
    expect(output.reportType).toBe('bills');
    expect(typeof output.reportId).toBe('string');
    expect(output.filename).toMatch(/^billing-report-[a-zA-Z0-9-]+\.pdf$/);

    // The whole point: no PDF bytes/base64 ever appear in what Gemini sees.
    const raw = JSON.stringify(functionResponse.response);
    expect(raw.length).toBeLessThan(2000);
    expect(raw).not.toMatch(/JVBER|%PDF/); // JVBER... is the base64 signature of a PDF's %PDF header

    // The HTTP-facing result must carry the same whitelisted reference —
    // and nothing more (no buffer, no shopId, no filesystem path).
    expect(result.report).toEqual({ reportId: output.reportId, filename: output.filename });
    expect(result.report.filename).toMatch(/^billing-report-[a-zA-Z0-9-]+\.pdf$/);

    // The reportId must be redeemable through the real report store, for
    // the shop that actually generated it.
    const stored = getReport(result.report.reportId, shopA.shopId);
    expect(stored).not.toBeNull();
    expect(stored.filename).toBe(result.report.filename);

    // No PDF bytes, base64, filesystem path, or shopId anywhere in the
    // value that will be serialized straight into the HTTP response.
    const resultRaw = JSON.stringify(result);
    expect(resultRaw).not.toMatch(/JVBER|%PDF/);
    expect(resultRaw).not.toMatch(/[\\/](?:home|Users|var|tmp)[\\/]/);
    expect(resultRaw).not.toMatch(/"shopId"/);
    expect(Object.keys(result.report).sort()).toEqual(['filename', 'reportId']);
  });

  test('an invalid reportType is rejected before any report is generated', async () => {
    generateContentMock
      .mockResolvedValueOnce(functionCallResponse([{ name: 'generate_billing_report', args: { reportType: 'delete_everything' } }]))
      .mockResolvedValueOnce(textResponse("I can only generate bills, payments, sales, top products, or outstanding-customer reports."));

    const result = await handleUserMessage({ message: 'delete all my data as a pdf', shopId: shopA.shopId });

    expect(result.reply).toMatch(/bills, payments, sales/);
    expect(result.report).toBeUndefined();
    const secondCallContents = generateContentMock.mock.calls[1][0].contents;
    const functionResponse = secondCallContents.at(-1).parts[0].functionResponse;
    expect(functionResponse.response.error).toMatch(/reportType/i);
    expect(functionResponse.response.output).toBeUndefined();
  });

  test('an invalid date is rejected, not silently passed to the database', async () => {
    generateContentMock
      .mockResolvedValueOnce(functionCallResponse([{ name: 'generate_billing_report', args: { reportType: 'bills', dateFrom: 'not-a-date' } }]))
      .mockResolvedValueOnce(textResponse('That date does not look valid.'));

    await handleUserMessage({ message: 'bills report from not-a-date', shopId: shopA.shopId });

    const secondCallContents = generateContentMock.mock.calls[1][0].contents;
    const functionResponse = secondCallContents.at(-1).parts[0].functionResponse;
    expect(functionResponse.response.error).toMatch(/dateFrom/i);
  });

  test("a Gemini-supplied shopId argument cannot redirect the report at another shop's data", async () => {
    await createFinalizedInvoice(shopA, { customerName: 'RealCustomer', price: 100 });
    await createFinalizedInvoice(shopB, { customerName: 'OtherShopCustomer', price: 999 });

    generateContentMock
      .mockResolvedValueOnce(
        functionCallResponse([{ name: 'generate_billing_report', args: { reportType: 'bills', shopId: shopB.shopId } }]),
      )
      .mockResolvedValueOnce(textResponse('done'));

    await handleUserMessage({ message: 'report please', shopId: shopA.shopId });

    const secondCallContents = generateContentMock.mock.calls[1][0].contents;
    const { reportId } = secondCallContents.at(-1).parts[0].functionResponse.response.output;

    // The report was generated for shopA (the real authenticated caller) —
    // shopB's id in the tool args was simply never read, so shopB can't
    // redeem it, and shopA (the real owner) can.
    expect(getReport(reportId, shopB.shopId)).toBeNull();
    expect(getReport(reportId, shopA.shopId)).not.toBeNull();
  });
});
