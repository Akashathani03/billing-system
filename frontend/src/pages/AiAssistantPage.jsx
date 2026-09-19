import { useRef, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { AiChatMessage } from '../components/AiChatMessage';
import { useSendChatMessageMutation } from '../hooks/useAiAssistant';
import { fetchAiReportPdfBlob } from '../api/ai';
import { downloadPdfBlob } from '../utils/pdfActions';

const SUGGESTED_PROMPTS = [
  'Show paid bills in August',
  'Show pending payments',
  'What are my top products?',
  'Who owes me money?',
  'How do I create a bill?',
  'Give me a sales report',
];

// Matches backend/routes/ai.routes.js's own isLength({ max: 500 }) — keeps
// the user from typing something the server would reject anyway.
const MAX_MESSAGE_LENGTH = 500;

const GENERIC_ERROR = "Sorry, I couldn't process that request. Please try again.";

// Defensive whitelist: only a well-formed { reportId, filename } pair taken
// directly from the backend's own /api/ai/chat response can ever become a
// download button — never anything derived from the reply text, the user's
// message, or any other field the response happens to contain.
function getValidReport(report) {
  if (!report || typeof report.reportId !== 'string' || !report.reportId.trim()) {
    return null;
  }
  return {
    reportId: report.reportId,
    filename: typeof report.filename === 'string' ? report.filename : undefined,
  };
}

export function AiAssistantPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);
  const sendMessage = useSendChatMessageMutation();
  const bottomRef = useRef(null);

  const sending = sendMessage.isPending;

  function scrollToBottom() {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
  }

  async function handleSend(promptOverride) {
    const text = (promptOverride ?? input).trim();
    if (!text || sending) return;

    setError('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    scrollToBottom();

    try {
      const data = await sendMessage.mutateAsync(text);
      const report = getValidReport(data.report);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: data.reply, reportId: report?.reportId, filename: report?.filename },
      ]);
    } catch (err) {
      setError(err.message || GENERIC_ERROR);
    }

    scrollToBottom();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleDownload(reportId, filename) {
    setDownloadingId(reportId);
    setError('');
    try {
      const blob = await fetchAiReportPdfBlob(reportId);
      downloadPdfBlob(blob, filename || 'report.pdf');
    } catch {
      setError("Sorry, I couldn't download that report. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="px-4 pt-6 pb-44">
      <PageHeader title="Clerk" />
      <p className="mt-2 text-sm text-neutral-500">Ask about your billing data.</p>

      {messages.length === 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSend(prompt)}
              disabled={sending}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 active:bg-neutral-50 disabled:opacity-60"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3" aria-live="polite">
        {messages.map((msg, index) => (
          <AiChatMessage
            key={index}
            role={msg.role}
            text={msg.text}
            reportId={msg.reportId}
            downloading={downloadingId === msg.reportId}
            onDownload={() => handleDownload(msg.reportId, msg.filename)}
          />
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-500">
              Thinking…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-24 z-10 flex items-end gap-2 border-t border-neutral-200 bg-white px-4 py-3">
        <label htmlFor="ai-assistant-input" className="sr-only">
          Ask about your billing data
        </label>
        <textarea
          id="ai-assistant-input"
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={handleKeyDown}
          placeholder="Ask your clerk to your business"
          rows={1}
          disabled={sending}
          className="max-h-28 flex-1 resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => handleSend()}
          disabled={sending || !input.trim()}
          aria-label="Send message"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-700 text-white disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
