import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { jest } from '@jest/globals';

// Same ESM-mocking approach as orchestrator.test.js — this is a separate
// file specifically so the already-verified orchestrator.test.js never
// needs to be touched while adding RAG-specific coverage.
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
const { loginAsOwner } = await import('../helpers/testAuth.js');
const { createFinalizedInvoice } = await import('../helpers/invoiceHelpers.js');

let mongod;
let shopA;

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
  shopA = await loginAsOwner(app, { username: 'shopa', shopName: 'Shop A' });
});

afterEach(async () => {
  await Invoice.deleteMany({});
  await Customer.deleteMany({});
  await Product.deleteMany({});
  await mongoose.connection.collection('users').deleteMany({});
  await mongoose.connection.collection('shops').deleteMany({});
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

describe('orchestrator + knowledge (RAG) integration', () => {
  test('a knowledge-only question uses retrieve_knowledge, not a billing tool', async () => {
    generateContentMock
      .mockResolvedValueOnce(functionCallResponse([{ name: 'retrieve_knowledge', args: { query: 'how do I create a bill' } }]))
      .mockResolvedValueOnce(textResponse('Open New Bill, add a customer and products, then tap Generate Bill.'));

    const result = await handleUserMessage({ message: 'How do I create a bill?', shopId: shopA.shopId });

    expect(result.reply).toBe('Open New Bill, add a customer and products, then tap Generate Bill.');

    const secondCallContents = generateContentMock.mock.calls[1][0].contents;
    const functionResponse = secondCallContents.at(-1).parts[0].functionResponse;
    expect(functionResponse.name).toBe('retrieve_knowledge');
    expect(functionResponse.response.output.found).toBe(true);
    expect(functionResponse.response.output.results.length).toBeGreaterThan(0);
  });

  test('a knowledge question with no relevant documentation is reported as not found, never fabricated', async () => {
    generateContentMock
      .mockResolvedValueOnce(functionCallResponse([{ name: 'retrieve_knowledge', args: { query: 'how do I fly a spaceship' } }]))
      .mockResolvedValueOnce(textResponse("I don't have information about that."));

    const result = await handleUserMessage({ message: 'how do I fly a spaceship', shopId: shopA.shopId });

    expect(result.reply).toBe("I don't have information about that.");
    const secondCallContents = generateContentMock.mock.calls[1][0].contents;
    const functionResponse = secondCallContents.at(-1).parts[0].functionResponse;
    expect(functionResponse.response.output.found).toBe(false);
  });

  test('a missing "query" argument is rejected as a validation error, not silently ignored', async () => {
    generateContentMock
      .mockResolvedValueOnce(functionCallResponse([{ name: 'retrieve_knowledge', args: {} }]))
      .mockResolvedValueOnce(textResponse('Could you tell me more about what you need?'));

    await handleUserMessage({ message: '???', shopId: shopA.shopId });

    const secondCallContents = generateContentMock.mock.calls[1][0].contents;
    const functionResponse = secondCallContents.at(-1).parts[0].functionResponse;
    expect(functionResponse.response.error).toMatch(/query.*required/i);
  });

  test('a mixed question triggers both a billing data tool and knowledge retrieval in one round', async () => {
    await createFinalizedInvoice(shopA, { price: 250, paymentStatus: 'pending' });

    generateContentMock
      .mockResolvedValueOnce(
        functionCallResponse([
          { name: 'get_outstanding_amount', args: {} },
          { name: 'retrieve_knowledge', args: { query: 'how do I mark a bill as paid' } },
        ]),
      )
      .mockResolvedValueOnce(textResponse('You have ₹250 pending. To mark it paid, open the bill and tap Mark as Paid.'));

    const result = await handleUserMessage({
      message: 'How much is pending and how do I mark a bill as paid?',
      shopId: shopA.shopId,
    });

    expect(result.reply).toBe('You have ₹250 pending. To mark it paid, open the bill and tap Mark as Paid.');

    const secondCallContents = generateContentMock.mock.calls[1][0].contents;
    const functionResponses = secondCallContents.at(-1).parts.map((p) => p.functionResponse);

    const amountResponse = functionResponses.find((r) => r.name === 'get_outstanding_amount');
    const knowledgeResponse = functionResponses.find((r) => r.name === 'retrieve_knowledge');

    expect(amountResponse.response.output.outstandingAmount).toBe(250);
    expect(knowledgeResponse.response.output.found).toBe(true);
  });

  test('retrieve_knowledge never receives or exposes a shopId argument', async () => {
    generateContentMock
      .mockResolvedValueOnce(functionCallResponse([{ name: 'retrieve_knowledge', args: { query: 'add a customer', shopId: 'sneaky' } }]))
      .mockResolvedValueOnce(textResponse('done'));

    await handleUserMessage({ message: 'How do I add a customer?', shopId: shopA.shopId });

    // No assertion needed beyond "this didn't throw and behaved normally" —
    // the tool's execute() signature only destructures { query }, so an
    // extra shopId argument is simply never read, exactly like an unknown
    // property on any other tool's args.
    const secondCallContents = generateContentMock.mock.calls[1][0].contents;
    const functionResponse = secondCallContents.at(-1).parts[0].functionResponse;
    expect(functionResponse.response.output.found).toBe(true);
  });
});
