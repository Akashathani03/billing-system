import { apiFetch, apiFetchBlob } from './client';

// shopId is never part of this request — the backend derives it from the
// authenticated session (the same httpOnly cookie every other request
// already uses via apiFetch's credentials: 'include'), never from anything
// the client sends.
export function sendChatMessage(message) {
  return apiFetch('/ai/chat', { method: 'POST', body: JSON.stringify({ message }) });
}

// Mirrors fetchInvoicePdfBlob's authenticated-blob pattern exactly — no
// manual headers/JWTs, and only ever called with a reportId the backend
// itself returned in a chat response, never a client-constructed path or URL.
export function fetchAiReportPdfBlob(reportId) {
  return apiFetchBlob(`/ai/reports/${reportId}`);
}
