import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { jest } from '@jest/globals';

// Gemini is the one genuinely external dependency here, so it's the only
// thing mocked — every DB call in these tests hits a real MongoMemoryServer,
// same as the rest of this test suite, so shop isolation is proven against
// real data instead of assumed. This project has no Babel/CJS transform
// ("type": "module" + `--experimental-vm-modules`), so ESM module mocking
// requires jest.unstable_mockModule *before* the mocked path is ever
// imported — including transitively — which is why every import below is a
// dynamic `await import(...)` rather than a static import.
const generateContentMock = jest.fn();

jest.unstable_mockModule('../../services/ai/geminiClient.js', () => ({
  getGeminiClient: () => ({ models: { generateContent: generateContentMock } }),
  DEFAULT_GEMINI_MODEL: 'test-model',
}));

const { handleUserMessage, MAX_TOOL_ROUNDS } = await import('../../services/ai/orchestrator.service.js');
const app = (await import('../../app.js')).default;
const { default: Invoice } = await import('../../models/Invoice.js');
const { default: Customer } = await import('../../models/Customer.js');
const { default: Product } = await import('../../models/Product.js');
const { loginAsOwner } = await import('../helpers/testAuth.js');
const { createFinalizedInvoice } = await import('../helpers/invoiceHelpers.js');

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
  shopA = await loginAsOwner(app, { username: 'shopa', shopName: 'Shop A' });
  shopB = await loginAsOwner(app, { username: 'shopb', shopName: 'Shop B' });
});

afterEach(async () => {
  await Invoice.deleteMany({});
  await Customer.deleteMany({});
  await Product.deleteMany({});
  await mongoose.connection.collection('users').deleteMany({});
  await mongoose.connection.collection('shops').deleteMany({});
  await mongoose.connection.collection('counters').deleteMany({});
});

/** Builds a minimal fake response shaped like the real SDK's — only what the orchestrator reads. */
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

describe('handleUserMessage', () => {
  test('1: a normal Gemini text response is returned as-is, with no tool calls', async () => {
    generateContentMock.mockResolvedValueOnce(textResponse('Hello! How can I help with your billing today?'));

    const result = await handleUserMessage({ message: 'hi', shopId: shopA.shopId });

    expect(result.reply).toBe('Hello! How can I help with your billing today?');
    expect(result.report).toBeUndefined();
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  test('2: Gemini requests get_bills and receives only the authenticated shop\'s data', async () => {
    await createFinalizedInvoice(shopA, { customerName: 'Ramesh', price: 100 });
    await createFinalizedInvoice(shopB, { customerName: 'NotRamesh', price: 999 });

    generateContentMock
      .mockResolvedValueOnce(functionCallResponse([{ name: 'get_bills', args: { status: 'finalized' } }]))
      .mockResolvedValueOnce(textResponse('You have one bill for Ramesh.'));

    const result = await handleUserMessage({ message: 'Show my bills', shopId: shopA.shopId });

    expect(result.reply).toBe('You have one bill for Ramesh.');
    expect(generateContentMock).toHaveBeenCalledTimes(2);

    // Inspect exactly what the tool sent back to Gemini on the second call.
    const secondCallContents = generateContentMock.mock.calls[1][0].contents;
    const functionResponsePart = secondCallContents.at(-1).parts[0].functionResponse;
    const bills = functionResponsePart.response.output.bills;

    expect(bills).toHaveLength(1);
    expect(bills[0].customerName).toBe('Ramesh');
    expect(bills.some((b) => b.customerName === 'NotRamesh')).toBe(false);
  });

  test('3: shopId always comes from the authenticated caller, never from a Gemini-supplied argument', async () => {
    await createFinalizedInvoice(shopA, { customerName: 'RealShopCustomer', price: 100 });
    await createFinalizedInvoice(shopB, { customerName: 'OtherShopCustomer', price: 999 });

    // Simulate an adversarial/confused Gemini trying to smuggle a different
    // shop's id in as a tool argument even though no tool schema declares one.
    generateContentMock
      .mockResolvedValueOnce(
        functionCallResponse([{ name: 'get_bills', args: { status: 'finalized', shopId: shopB.shopId } }]),
      )
      .mockResolvedValueOnce(textResponse('done'));

    await handleUserMessage({ message: 'Show bills', shopId: shopA.shopId });

    const secondCallContents = generateContentMock.mock.calls[1][0].contents;
    const bills = secondCallContents.at(-1).parts[0].functionResponse.response.output.bills;

    expect(bills).toHaveLength(1);
    expect(bills[0].customerName).toBe('RealShopCustomer');
  });

  test('4: an unknown/non-allowlisted tool name is rejected safely', async () => {
    generateContentMock
      .mockResolvedValueOnce(functionCallResponse([{ name: 'delete_everything', args: {} }]))
      .mockResolvedValueOnce(textResponse("I can't do that, but I can answer billing questions."));

    const result = await handleUserMessage({ message: 'delete all my data', shopId: shopA.shopId });

    expect(result.reply).toBe("I can't do that, but I can answer billing questions.");
    const secondCallContents = generateContentMock.mock.calls[1][0].contents;
    const functionResponse = secondCallContents.at(-1).parts[0].functionResponse;
    expect(functionResponse.response.error).toMatch(/unknown tool/i);
    expect(functionResponse.response.output).toBeUndefined();
  });

  test('5: malformed tool arguments are rejected safely, not passed through to the database', async () => {
    generateContentMock
      .mockResolvedValueOnce(functionCallResponse([{ name: 'get_bills', args: { status: 'not-a-real-status' } }]))
      .mockResolvedValueOnce(textResponse('That status is not valid.'));

    const result = await handleUserMessage({ message: 'Show status=whatever bills', shopId: shopA.shopId });

    expect(result.reply).toBe('That status is not valid.');
    const secondCallContents = generateContentMock.mock.calls[1][0].contents;
    const functionResponse = secondCallContents.at(-1).parts[0].functionResponse;
    expect(functionResponse.response.error).toMatch(/status/i);
    expect(functionResponse.response.output).toBeUndefined();
  });

  test('6: an internal tool failure is reported to Gemini as a safe, generic message', async () => {
    generateContentMock
      .mockResolvedValueOnce(functionCallResponse([{ name: 'get_top_products', args: {} }]))
      .mockResolvedValueOnce(textResponse('Something went wrong.'));

    // A malformed shopId simulates a genuine internal failure (e.g. a bad
    // id reaching Mongoose) without needing to mock the database layer.
    const result = await handleUserMessage({ message: 'top products', shopId: 'not-a-valid-object-id' });

    expect(result.reply).toBe('Something went wrong.');
    const secondCallContents = generateContentMock.mock.calls[1][0].contents;
    const functionResponse = secondCallContents.at(-1).parts[0].functionResponse;

    expect(functionResponse.response.error).toBe('That data is temporarily unavailable.');
    // The raw driver/ODM error must never leak into what Gemini (and so the user) sees.
    expect(JSON.stringify(functionResponse.response)).not.toMatch(/mongo|bson|cast to objectid/i);
  });

  test('7: a hard cap on tool rounds prevents an infinite tool-call loop', async () => {
    // Gemini "never" stops asking for tools — every single call gets a function call response.
    generateContentMock.mockImplementation(async () =>
      functionCallResponse([{ name: 'get_outstanding_amount', args: {} }]),
    );

    const result = await handleUserMessage({ message: 'keep going forever', shopId: shopA.shopId });

    expect(result.reply).toMatch(/wasn't able to finish/i);
    // MAX_TOOL_ROUNDS rounds of tool-calling, plus the one initial call — never unbounded.
    expect(generateContentMock).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS + 1);
  });
});
