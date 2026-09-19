import { GoogleGenAI } from '@google/genai';

/**
 * Kept in sync with Google's currently supported Gemini models
 * (https://ai.google.dev/gemini-api/docs/models) — Gemini 2.0 and 2.5 Flash
 * have both been retired (calling them now 404s with "no longer available",
 * confirmed directly against the live API), and "gemini-3.8-flash" is not a
 * real published model (calling it 429s against a free-tier quota that was
 * never actually usable). "gemini-3.6-flash" is what Google's own 404/model
 * responses name as the current replacement, and is confirmed working
 * end-to-end against this project's API key. Update this one constant to
 * move every caller onto a newer model at once.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

/**
 * @google/genai retries 408/429/5xx by default — up to 5 attempts, backing
 * off exponentially to as much as 60s each (see its own DEFAULT_RETRY_*
 * constants) — with NO per-attempt timeout unless one is set here. That
 * means a transient outage on Google's side (e.g. a 503 "model overloaded",
 * confirmed to happen in practice) can leave a caller waiting for minutes
 * with nothing to catch or cancel — indistinguishable from a genuine hang.
 * This keeps a short retry for a momentary blip, but bounds the worst case
 * to something an interactive chat request can actually wait on.
 *
 * 429 is deliberately left out of httpStatusCodes: it means this key's quota
 * is exhausted, which a 1-8s backoff cannot fix (Google's own retry hint is
 * tens of seconds, and a daily quota resets in hours), so retrying only makes
 * the user wait longer for the same failure. It surfaces immediately as an
 * ApiError with .status === 429, which the orchestrator turns into a specific
 * usage-limit message.
 */
const HTTP_OPTIONS = {
  timeout: 15000,
  retryOptions: {
    attempts: 4,
    initialDelay: 1,
    maxDelay: 8,
    httpStatusCodes: [408, 500, 502, 503, 504],
  },
};

let client;

/**
 * Returns the shared Gemini client, creating it on first use rather than at
 * import time — same lazy-singleton shape as objectStorage.service.js's
 * getClient() — so importing this module never crashes the app just
 * because GEMINI_API_KEY isn't set; only whatever actually tries to call
 * Gemini does, with a clear error naming the missing variable.
 */
export function getGeminiClient() {
  if (!client) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini is not configured — set GEMINI_API_KEY');
    }
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: HTTP_OPTIONS });
  }
  return client;
}
