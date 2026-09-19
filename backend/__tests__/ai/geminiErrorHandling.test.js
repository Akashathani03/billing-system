import http from 'node:http';
import { jest } from '@jest/globals';
import { handleUserMessage } from '../../services/ai/orchestrator.service.js';

// Unlike orchestrator.test.js, nothing about Gemini is mocked at the module
// level here: the real geminiClient.js config (retry count, backoff, which
// status codes retry), the real @google/genai SDK, and the real orchestrator
// all run. Only the network peer is fake — a local HTTP server that replays a
// scripted sequence of statuses — reached via the SDK's own
// GOOGLE_GEMINI_BASE_URL override. That is what lets these tests prove "429 is
// not retried" and "503/504 are" against the real production configuration,
// with no Google traffic and no quota used.

const TEXT_OK = {
  candidates: [{ content: { role: 'model', parts: [{ text: 'Hello from the mock.' }] }, finishReason: 'STOP', index: 0 }],
};

// retrieve_knowledge needs no database, so a tool round can run in this file.
const TOOL_CALL = {
  candidates: [
    {
      content: {
        role: 'model',
        parts: [{ functionCall: { name: 'retrieve_knowledge', args: { query: 'how do I create a bill' } } }],
      },
      finishReason: 'STOP',
      index: 0,
    },
  ],
};

const ERROR_STATUS_NAMES = {
  400: 'INVALID_ARGUMENT',
  401: 'UNAUTHENTICATED',
  403: 'PERMISSION_DENIED',
  404: 'NOT_FOUND',
  408: 'DEADLINE_EXCEEDED',
  429: 'RESOURCE_EXHAUSTED',
  500: 'INTERNAL',
  502: 'BAD_GATEWAY',
  503: 'UNAVAILABLE',
  504: 'DEADLINE_EXCEEDED',
};

// Deliberately shaped like Google's real 429 payload, so the tests can prove
// none of it reaches the user.
const QUOTA_MESSAGE =
  'You exceeded your current quota. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash. quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier';

/** 200 -> plain text answer, 'tool' -> a retrieve_knowledge function call, any other number -> that HTTP error. */
function respondFor(item) {
  if (item === 200) return { status: 200, body: TEXT_OK };
  if (item === 'tool') return { status: 200, body: TOOL_CALL };
  const message = item === 429 ? QUOTA_MESSAGE : `simulated ${item}`;
  return { status: item, body: { error: { code: item, message, status: ERROR_STATUS_NAMES[item] } } };
}

let server;
let script = [200];
let requestCount = 0;
const savedEnv = {};

beforeAll(async () => {
  server = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      requestCount += 1;
      const item = script[Math.min(requestCount - 1, script.length - 1)];
      const { status, body } = respondFor(item);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  // Must be set before the first getGeminiClient() call — the client is a
  // lazy singleton that reads both at construction.
  for (const key of ['GEMINI_API_KEY', 'GOOGLE_GEMINI_BASE_URL']) savedEnv[key] = process.env[key];
  process.env.GEMINI_API_KEY = 'test-dummy-key-not-real';
  process.env.GOOGLE_GEMINI_BASE_URL = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function ask(sequence) {
  script = sequence;
  requestCount = 0;
  const started = Date.now();
  const result = await handleUserMessage({ message: 'hi', shopId: 'test-shop-id' });
  return { result, requests: requestCount, seconds: (Date.now() - started) / 1000 };
}

describe('Gemini 429 (quota exhausted)', () => {
  test('is not retried and returns the specific usage-limit reply', async () => {
    const { result, requests, seconds } = await ask([429]);

    expect(requests).toBe(1);
    expect(seconds).toBeLessThan(3); // no backoff waits at all
    expect(result.reply).toMatch(/usage limit has been reached/i);
    expect(result.reply).not.toMatch(/isn't available right now/i);
    expect(result.report).toBeUndefined();
  });

  test("never leaks Google's payload, quota ids, or status names to the user", async () => {
    const { result } = await ask([429]);

    expect(JSON.stringify(result)).not.toMatch(
      /RESOURCE_EXHAUSTED|429|quota|GenerateRequests|PerDay|free_tier|limit: 20|generativelanguage|gemini-3|test-dummy-key/i,
    );
  });

  test('still leaves developers a server-side log line with the details', async () => {
    await ask([429]);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/quota exhausted \(429\)/i),
      expect.stringContaining('RESOURCE_EXHAUSTED'),
    );
  });

  test('is also handled, still without a retry, when it arrives after a tool call', async () => {
    const { result, requests } = await ask(['tool', 429]);

    expect(requests).toBe(2); // the tool-call request + one (unretried) 429
    expect(result.reply).toMatch(/usage limit has been reached/i);
  });
});

describe('transient Gemini errors are retried', () => {
  test.each([408, 500, 502, 503, 504])(
    'HTTP %i is retried, and the request then succeeds',
    async (status) => {
      const { result, requests } = await ask([status, 200]);

      expect(requests).toBe(2);
      expect(result.reply).toBe('Hello from the mock.');
    },
    20000,
  );

  test('a 503 after a tool call is retried too, and the final answer still arrives', async () => {
    const { result, requests } = await ask(['tool', 503, 200]);

    expect(requests).toBe(3);
    expect(result.reply).toBe('Hello from the mock.');
  }, 20000);

  test('a persistent 503 is retried a bounded 4 times, then falls back to the generic safe reply', async () => {
    const { result, requests, seconds } = await ask([503]);

    expect(requests).toBe(4); // 1 initial call + 3 retries, never more
    expect(seconds).toBeLessThan(25); // backoff is 1-2s, 2-4s, 4-8s — bounded, not indefinite
    expect(result.reply).toMatch(/isn't available right now/i);
    expect(result.reply).not.toMatch(/usage limit/i);
  }, 40000);
});

describe('other Gemini errors keep the existing generic fallback', () => {
  test.each([400, 401, 403, 404])(
    'HTTP %i is not retried and returns the generic reply, not the usage-limit one',
    async (status) => {
      const { result, requests } = await ask([status]);

      expect(requests).toBe(1);
      expect(result.reply).toMatch(/isn't available right now/i);
      expect(result.reply).not.toMatch(/usage limit/i);
    },
  );
});

describe('existing behavior is intact through the real SDK', () => {
  test('a normal answer takes one request, no retries, no report, and logs no error', async () => {
    const { result, requests } = await ask([200]);

    expect(requests).toBe(1);
    expect(result).toEqual({ reply: 'Hello from the mock.' });
    expect(console.error).not.toHaveBeenCalled();
  });
});
