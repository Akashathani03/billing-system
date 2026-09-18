import Shop from '../models/Shop.js';
import * as invoiceService from '../services/invoice.service.js';
import { renderInvoicePdf } from '../services/pdf.service.js';

export async function downloadInvoicePdf(req, res) {
  const invoice = await invoiceService.getInvoiceById(req.params.id, req.user.shopId);

  if (!invoice) {
    return res.status(404).json({ error: { message: 'Invoice not found', code: 'NOT_FOUND' } });
  }

  if (invoice.status === 'draft') {
    return res.status(409).json({
      error: { message: 'A draft invoice has no PDF — finalize it first', code: 'INVALID_STATE' },
    });
  }

  // invoice.shopId, not req.user.shopId — the invoice was already fetched
  // scoped to the requester's shop above, so this is guaranteed to be the
  // same shop, but reading it off the invoice itself keeps this tied to the
  // document actually being rendered.
  const shop = await Shop.findById(invoice.shopId);

  let pdfBuffer;
  try {
    pdfBuffer = await renderInvoicePdf(invoice, shop);
  } catch (err) {
    console.error('[pdf] generation failed for invoice', req.params.id, err);
    return res.status(500).json({
      error: { message: 'Unable to generate the invoice PDF', code: 'PDF_GENERATION_FAILED' },
    });
  }

  const disposition = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${invoice.invoiceNumber}.pdf"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.send(pdfBuffer);
}
