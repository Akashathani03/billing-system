import { getGeminiClient, DEFAULT_GEMINI_MODEL } from './geminiClient.js';
import { getToolDeclarations, executeTool, ToolValidationError } from './tools/index.js';
import { formatBusinessDateKey } from '../../utils/businessDate.js';

/** Bounds how many tool round-trips one message can trigger — never loop forever no matter what Gemini asks for. */
export const MAX_TOOL_ROUNDS = 3;

const UNAVAILABLE_REPLY = "Sorry, the AI billing assistant isn't available right now. Please try again in a moment.";
const QUOTA_REPLY = 'Clerk is temporarily unavailable because the AI usage limit has been reached. Please try again later.';
const NO_ANSWER_REPLY = "I wasn't able to work out an answer for that — could you rephrase or be more specific?";
const ROUND_LIMIT_REPLY = "I wasn't able to finish answering that — could you try a simpler or more specific question?";

function buildSystemInstruction() {
  const today = formatBusinessDateKey(new Date());
  return [
    'You are an AI billing assistant for the currently authenticated shop.',
    `Today's date (this shop's business timezone) is ${today}.`,
    "Answer questions about this shop's billing data.",
    'Use the billing data tools (get_bills, get_payment_totals, get_outstanding_amount, get_sales_by_month, get_top_products, get_customers_with_outstanding_balance) for any question about this shop\'s actual live data — never invent numbers, and never answer a data question from the knowledge base.',
    'Use the retrieve_knowledge tool for general how-to or product-knowledge questions about using the billing system (for example how to create a bill, add a customer or product, or what a term means) — never answer those from your own general knowledge, since the shop\'s own documentation is the only authoritative source for how this system works.',
    'A single question may need both: for example an amount plus a how-to explanation should use a data tool and retrieve_knowledge together.',
    'Use the generate_billing_report tool only when the user explicitly asks for a report, PDF, or download (for example "make a PDF of my August bills") — it produces a downloadable file, not a chat answer, so do not use it just to answer a plain data question. When it succeeds, tell the user their report is ready by name; do not describe or restate the report\'s contents yourself, since you never see the PDF itself.',
    'If retrieve_knowledge finds no relevant documentation, say plainly that the information is not available rather than guessing or making up how the system might work.',
    'If the requested data is unavailable or a tool fails, say so plainly rather than guessing.',
    "Never reveal or reference another shop's data — you only ever have access to the current shop.",
    'Never ask the user for a shop ID or any other account identifier — the shop is already known from their session.',
    'Do not claim a bill was created, updated, cancelled, or deleted unless a tool actually performed that action — this assistant is read-only for now and must not attempt to modify billing data.',
    'Keep responses concise and directly useful.',
    'When a question involves a date range, briefly state the date range you used.',
    'NEVER use a Markdown table, for anything — tables are unreadable on a phone screen.',
    'When listing multiple bills (paid bills, pending bills, a customer\'s bills, or invoice search results), start with one short summary line stating the filter and the count, for example "Here are the paid bills for August (14 bills):". Then list each bill as a numbered item shaped exactly like this, with a blank line between bills: first line "**Customer Name**" (bold, the primary thing shown), next line just the amount (e.g. "₹708.00"), next line the date and payment method together separated by " • " (e.g. "Aug 25, 2026 • UPI"). The invoice number may be added as a small extra detail only if useful, but never as the first or most prominent line, and never combine multiple bills\' fields onto one line.',
    'For a single aggregate figure (a total, a sum, an outstanding amount, or similar), use a short structure instead of prose or a table: a bold heading line (e.g. "**August Sales**"), then the amount alone on its own line, then a brief count or context line underneath (e.g. "14 finalized bills").',
  ].join(' ');
}

/**
 * Runs one user message through Gemini's tool-calling loop and returns its
 * final natural-language reply.
 *
 * `shopId` must be the authenticated caller's own shop (req.user.shopId,
 * verified by auth middleware) — it is threaded straight into executeTool()
 * for every tool call the model requests, and is never read from the
 * message text, from Gemini's output, or from any tool argument, so no
 * tool call can ever be redirected at another shop's data.
 */
export async function handleUserMessage({ message, shopId }) {
  if (!shopId) {
    throw new Error('handleUserMessage requires an authenticated shopId');
  }
  if (typeof message !== 'string' || !message.trim()) {
    throw new Error('handleUserMessage requires a non-empty message string');
  }

  let client;
  try {
    client = getGeminiClient();
  } catch (err) {
    console.error('[ai] Gemini client unavailable:', err.message);
    return { reply: UNAVAILABLE_REPLY };
  }

  const config = {
    systemInstruction: buildSystemInstruction(),
    tools: [{ functionDeclarations: getToolDeclarations() }],
  };
  const contents = [{ role: 'user', parts: [{ text: message }] }];

  let toolRounds = 0;
  // The only report reference ever allowed to reach the HTTP response —
  // populated exclusively from a *successful* generate_billing_report
  // result below, never from raw tool output, so a malicious or buggy tool
  // result can't smuggle extra fields (shopId, paths, buffers, ...) out.
  // If more than one report is generated across this turn's tool rounds,
  // the most recent one wins — the current chat UI only ever surfaces one
  // report per assistant reply, so there's nothing to gain from tracking
  // more than that.
  let capturedReport = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let response;
    try {
      // eslint-disable-next-line no-await-in-loop
      response = await client.models.generateContent({ model: DEFAULT_GEMINI_MODEL, contents, config });
    } catch (err) {
      // Quota exhaustion is the one Gemini failure worth telling the user
      // about specifically — it isn't transient like a 503, and "try again in
      // a moment" would be wrong. Only the fixed sentence below reaches the
      // user; Google's payload (quota ids, limits) stays in the server log.
      if (err?.status === 429) {
        console.error('[ai] Gemini quota exhausted (429):', err.message);
        return { reply: QUOTA_REPLY };
      }
      console.error('[ai] Gemini request failed:', err.message);
      return { reply: UNAVAILABLE_REPLY };
    }

    const functionCalls = response.functionCalls;
    if (!functionCalls || functionCalls.length === 0) {
      const reply = response.text || NO_ANSWER_REPLY;
      return capturedReport ? { reply, report: capturedReport } : { reply };
    }

    if (toolRounds >= MAX_TOOL_ROUNDS) {
      return { reply: ROUND_LIMIT_REPLY };
    }
    toolRounds += 1;

    contents.push(
      response.candidates?.[0]?.content ?? {
        role: 'model',
        parts: functionCalls.map((call) => ({ functionCall: call })),
      },
    );

    const responseParts = [];
    for (const call of functionCalls) {
      const name = call.name;
      let functionResult;
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await executeTool(name, call.args, shopId);
        functionResult = { output: result };

        if (
          name === 'generate_billing_report' &&
          result?.success === true &&
          typeof result.reportId === 'string' &&
          typeof result.filename === 'string'
        ) {
          // Whitelisted extraction, not a pass-through: only these two
          // fields are ever copied out, regardless of what else the tool
          // result contains.
          capturedReport = { reportId: result.reportId, filename: result.filename };
        }
      } catch (err) {
        if (err instanceof ToolValidationError) {
          console.warn('[ai] tool call rejected:', name, err.message);
          functionResult = { error: err.message };
        } else {
          // Never let a raw DB/internal error reach Gemini or the user.
          console.error('[ai] tool execution failed:', name, err);
          functionResult = { error: 'That data is temporarily unavailable.' };
        }
      }
      responseParts.push({ functionResponse: { name, response: functionResult } });
    }
    contents.push({ role: 'user', parts: responseParts });
  }
}
