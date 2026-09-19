import { handleUserMessage } from '../services/ai/orchestrator.service.js';
import { getReport } from '../services/ai/report.service.js';

// shopId always comes from req.user (set by requireAuth from the verified
// JWT) — never from req.body — so a client can never redirect a chat
// request at another shop's data. Any error handleUserMessage throws
// propagates to app.js's shared error handler like every other controller
// here, which already strips it down to a generic message unless the
// error explicitly opts in with `.expose`.
export async function chat(req, res) {
  const { message } = req.body;
  const result = await handleUserMessage({ message, shopId: req.user.shopId });
  // result.report (when present) is already the whitelisted {reportId,
  // filename} pair built in orchestrator.service.js — relayed as-is, same
  // as result.reply already was, never re-derived from anything client- or
  // model-supplied.
  res.json(result.report ? { reply: result.reply, report: result.report } : { reply: result.reply });
}

// Mirrors pdf.controller.js's downloadInvoicePdf exactly (same headers,
// same buffer-then-send shape). getReport() already returns null for a
// report that doesn't exist OR belongs to a different shop — the two cases
// are deliberately indistinguishable here, both a plain 404.
export async function downloadReport(req, res) {
  const report = getReport(req.params.reportId, req.user.shopId);

  if (!report) {
    return res.status(404).json({ error: { message: 'Report not found', code: 'NOT_FOUND' } });
  }

  res.setHeader('Content-Type', report.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
  res.setHeader('Content-Length', report.buffer.length);
  res.send(report.buffer);
}
