import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.resolve(__dirname, '../../knowledge');

/**
 * The complete, fixed set of documents this service will ever read. This is
 * the only place a filename is ever written — retrieveKnowledge() takes a
 * free-text query, never a path or filename, so there is no code path by
 * which a user query could select an arbitrary file or escape this
 * directory. Keep in sync with backend/knowledge/.
 */
const KNOWLEDGE_FILES = Object.freeze(['billing-help.md', 'invoice-guide.md', 'payment-guide.md', 'product-guide.md', 'faq.md']);

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'do', 'does', 'did', 'i', 'my', 'me', 'you', 'your', 'it', 'its', 'this', 'that',
  'of', 'in', 'on', 'for', 'to', 'and', 'or', 'how', 'what', 'can', 'with', 'be', 'as', 'at', 'by', 'from', 'if',
  'not', 'no', 'was', 'were', 'so', 'there', 'their', 'have', 'has', 'had',
]);

/**
 * Crude, deterministic singularization (drop a trailing "s" on longer
 * words) so "bills"/"bill", "products"/"product", "customers"/"customer"
 * etc. overlap when matching. Not a real stemmer, and it "mis-stems" some
 * words (e.g. "status" -> "statu") — harmless here since normalization is
 * applied identically to both documents and queries, so matching still
 * works; these normalized forms are never shown to anyone.
 */
function normalizeToken(word) {
  return word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word;
}

function tokenize(text) {
  return (String(text).toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map(normalizeToken);
}

/** Splits one file's Markdown into chunks on "## " headings, keeping the h1/intro as its own leading chunk. */
function chunkMarkdown(source, raw) {
  const sections = raw.split(/\n(?=##\s+)/);
  const chunks = [];

  for (const section of sections) {
    const text = section.trim();
    if (!text) continue;

    const headingMatch = text.match(/^#{1,2}\s+(.+)$/m);
    const heading = headingMatch ? headingMatch[1].trim() : source;

    chunks.push({
      source,
      heading,
      text,
      tokens: tokenize(`${heading} ${text}`),
      headingTokens: tokenize(heading),
    });
  }

  return chunks;
}

let chunksCache = null;

function loadChunks() {
  if (!chunksCache) {
    chunksCache = KNOWLEDGE_FILES.flatMap((file) => chunkMarkdown(file, fs.readFileSync(path.join(KNOWLEDGE_DIR, file), 'utf8')));
  }
  return chunksCache;
}

function countMatches(tokenList, queryTokenSet) {
  let total = 0;
  const matched = new Set();
  for (const token of tokenList) {
    if (queryTokenSet.has(token)) {
      total += 1;
      matched.add(token);
    }
  }
  return { total, matched };
}

// A chunk must match at least this many distinct, meaningful query terms to
// count as relevant at all — below this, the query is treated as unrelated
// to the static documentation rather than forcing a weak, misleading match.
const MIN_MATCHED_TOKENS = 1;

/**
 * Simple deterministic lexical retrieval over the static knowledge base:
 * no embeddings, no external service. Each candidate chunk is scored by how
 * many of the query's (stopword-stripped, singularized) terms it contains,
 * with a term appearing in the chunk's own heading counting double — a
 * topic's heading is a much stronger signal than an incidental word in the
 * body. Chunks that don't clear MIN_MATCHED_TOKENS are dropped entirely, so
 * an unrelated query correctly comes back with nothing rather than the
 * least-bad guess.
 */
export function retrieveKnowledge(query, { limit = 3 } = {}) {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) {
    return { found: false, chunks: [] };
  }

  const results = loadChunks()
    .map((chunk) => {
      const body = countMatches(chunk.tokens, queryTokens);
      const heading = countMatches(chunk.headingTokens, queryTokens);
      const matchedCount = new Set([...body.matched, ...heading.matched]).size;
      return { chunk, score: body.total + heading.total * 2, matchedCount };
    })
    .filter((r) => r.score > 0 && r.matchedCount >= MIN_MATCHED_TOKENS)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (results.length === 0) {
    return { found: false, chunks: [] };
  }

  return {
    found: true,
    chunks: results.map(({ chunk, score }) => ({ source: chunk.source, heading: chunk.heading, text: chunk.text, score })),
  };
}

/** Test-only: forces the next retrieveKnowledge() call to re-read the files from disk. */
export function _testOnlyClearCache() {
  chunksCache = null;
}
