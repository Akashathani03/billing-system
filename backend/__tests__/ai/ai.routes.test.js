import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { jest } from '@jest/globals';

// The orchestrator (and therefore Gemini) is mocked here — these are
// HTTP/controller-layer tests, not orchestrator tests (see
// __tests__/ai/orchestrator.test.js for those, which mock Gemini itself and
// exercise the real orchestrator). Same ESM-mocking approach used there:
// this project has no Babel/CJS transform, so jest.unstable_mockModule must
// run before the mocked path is ever imported, including transitively —
// hence dynamic imports below instead of static ones.
const handleUserMessageMock = jest.fn();

jest.unstable_mockModule('../../services/ai/orchestrator.service.js', () => ({
  handleUserMessage: handleUserMessageMock,
}));

const app = (await import('../../app.js')).default;
const { default: Shop } = await import('../../models/Shop.js');
const { default: User } = await import('../../models/User.js');
const { loginAsOwner } = await import('../helpers/testAuth.js');

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
  handleUserMessageMock.mockReset();
  handleUserMessageMock.mockResolvedValue({ reply: 'Here is your answer.' });
  agent = await loginAsOwner(app);
});

afterEach(async () => {
  await User.deleteMany({});
  await Shop.deleteMany({});
});

describe('POST /api/ai/chat', () => {
  test('requires authentication', async () => {
    const res = await request(app).post('/api/ai/chat').send({ message: 'Show paid bills in August' });

    expect(res.status).toBe(401);
    expect(handleUserMessageMock).not.toHaveBeenCalled();
  });

  test('a valid authenticated request succeeds with the expected response shape', async () => {
    const res = await agent.post('/api/ai/chat').send({ message: 'Show paid bills in August' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reply: 'Here is your answer.' });
  });

  test("req.user.shopId (not the request body) is passed to the orchestrator", async () => {
    await agent.post('/api/ai/chat').send({ message: 'Show paid bills in August' });

    expect(handleUserMessageMock).toHaveBeenCalledWith({
      message: 'Show paid bills in August',
      shopId: agent.shopId,
    });
  });

  test('a body.shopId cannot override the authenticated shop context', async () => {
    await agent.post('/api/ai/chat').send({ message: 'Show bills', shopId: 'another-shop-id' });

    expect(handleUserMessageMock).toHaveBeenCalledTimes(1);
    const callArg = handleUserMessageMock.mock.calls[0][0];
    expect(callArg.shopId).toBe(agent.shopId);
    expect(callArg.shopId).not.toBe('another-shop-id');
    expect(callArg).not.toHaveProperty('shopId', 'another-shop-id');
  });

  test('a missing message is rejected', async () => {
    const res = await agent.post('/api/ai/chat').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(handleUserMessageMock).not.toHaveBeenCalled();
  });

  test('an empty (whitespace-only) message is rejected', async () => {
    const res = await agent.post('/api/ai/chat').send({ message: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(handleUserMessageMock).not.toHaveBeenCalled();
  });

  test('a non-string message is rejected', async () => {
    const res = await agent.post('/api/ai/chat').send({ message: 12345 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(handleUserMessageMock).not.toHaveBeenCalled();
  });

  test('an oversized message is rejected', async () => {
    const res = await agent.post('/api/ai/chat').send({ message: 'a'.repeat(501) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(handleUserMessageMock).not.toHaveBeenCalled();
  });

  test('a message at exactly the length limit is accepted', async () => {
    const res = await agent.post('/api/ai/chat').send({ message: 'a'.repeat(500) });

    expect(res.status).toBe(200);
  });

  test('an internal orchestrator failure becomes a safe, generic HTTP error', async () => {
    // Synthetic marker text standing in for sensitive internal detail — it must
    // never appear in the HTTP response.
    handleUserMessageMock.mockRejectedValueOnce(
      new Error('INTERNAL_ONLY_DETAIL_MARKER: upstream at internal-host.example failed'),
    );

    const res = await agent.post('/api/ai/chat').send({ message: 'Show paid bills in August' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).toBe('Internal server error');

    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/INTERNAL_ONLY_DETAIL_MARKER|internal-host\.example|at handleUserMessage|\.js:\d+:\d+/);
  });
});
