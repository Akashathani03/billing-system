import PDFDocument from 'pdfkit';
import { BUSINESS_TIMEZONE } from '../config/businessConfig.js';

const PAGE_LEFT = 50;
const PAGE_RIGHT = 545;

const METHOD_LABELS = { cash: 'Cash', upi: 'UPI', card: 'Card', credit: 'Credit' };
const STATUS_LABELS = { paid: 'Paid', pending: 'Pending' };

/**
 * PDFKit's base14 fonts (Helvetica etc.) use WinAnsiEncoding, which does
 * not include the ₹ Rupee sign (U+20B9) — that glyph postdates WinAnsi by
 * decades. Rather than bundle a Unicode font just to render one symbol,
 * this uses "Rs." (a standard, universally understood substitute on Indian
 * invoices) so amounts always render correctly with zero added dependency.
 */
export function formatMoney(amount) {
  return `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    timeZone: BUSINESS_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function drawHeader(doc, shopConfig) {
  const textLeft = PAGE_LEFT;
  const textWidth = PAGE_RIGHT - textLeft;

  doc.fontSize(18).font('Helvetica-Bold').text(shopConfig.name || 'Invoice', textLeft, 48, {
    width: textWidth,
    align: 'center',
  });

  doc.fontSize(9).font('Helvetica');
  if (shopConfig.address) {
    doc.text(shopConfig.address, textLeft, doc.y, { width: textWidth, align: 'center' });
  }
  const contactLine = [shopConfig.phone ? `Ph: ${shopConfig.phone}` : null, shopConfig.email]
    .filter(Boolean)
    .join('   |   ');
  if (contactLine) {
    doc.text(contactLine, textLeft, doc.y, { width: textWidth, align: 'center' });
  }
  doc.y = Math.max(doc.y, 110);
  doc.moveDown(0.5);
  doc.moveTo(PAGE_LEFT, doc.y).lineTo(PAGE_RIGHT, doc.y).strokeColor('#cccccc').stroke();
  doc.fillColor('black');
  doc.moveDown(0.6);
}

function drawTitle(doc, invoice) {
  if (invoice.status === 'cancelled') {
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#b91c1c').text('CANCELLED', { align: 'center' });
    doc.fillColor('black');
    doc.moveDown(0.3);
  }
  doc.fontSize(15).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
  doc.moveDown(0.6);
}

function drawInvoiceAndCustomerInfo(doc, invoice) {
  const startY = doc.y;
  const rightColX = 330;

  doc.fontSize(10).font('Helvetica-Bold').text('Customer', PAGE_LEFT, startY);
  doc.font('Helvetica');
  doc.text(invoice.customer.name, PAGE_LEFT, doc.y);
  doc.text(invoice.customer.mobile, PAGE_LEFT, doc.y);
  if (invoice.customer.address) doc.text(invoice.customer.address, PAGE_LEFT, doc.y, { width: 250 });

  doc.font('Helvetica-Bold').text('Invoice No:', rightColX, startY, { continued: true });
  doc.font('Helvetica').text(` ${invoice.invoiceNumber}`);
  doc.font('Helvetica-Bold').text('Date:', rightColX, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${formatDate(invoice.finalizedAt)}`);

  doc.y = Math.max(doc.y, startY + 60);
  doc.moveDown(0.6);
  doc.moveTo(PAGE_LEFT, doc.y).lineTo(PAGE_RIGHT, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.5);
}

const COL = { product: PAGE_LEFT, qty: 310, price: 380, total: 470 };

function drawItemsTableHeader(doc) {
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Product', COL.product, doc.y, { width: 250 });
  doc.text('Qty', COL.qty, doc.y - doc.currentLineHeight(), { width: 60, align: 'right' });
  doc.text('Price', COL.price, doc.y - doc.currentLineHeight(), { width: 80, align: 'right' });
  doc.text('Total', COL.total, doc.y - doc.currentLineHeight(), { width: 75, align: 'right' });
  doc.moveDown(0.3);
  doc.moveTo(PAGE_LEFT, doc.y).lineTo(PAGE_RIGHT, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.3);
}

function drawItems(doc, invoice) {
  drawItemsTableHeader(doc);
  doc.font('Helvetica').fontSize(10);

  invoice.items.forEach((item) => {
    const rowY = doc.y;
    const qtyLabel = item.unit ? `${item.quantity} ${item.unit}` : String(item.quantity);
    doc.text(item.name, COL.product, rowY, { width: 250 });
    doc.text(qtyLabel, COL.qty, rowY, { width: 60, align: 'right' });
    doc.text(formatMoney(item.price), COL.price, rowY, { width: 80, align: 'right' });
    doc.text(formatMoney(item.lineTotal), COL.total, rowY, { width: 75, align: 'right' });
    doc.moveDown(0.4);
  });

  doc.moveTo(PAGE_LEFT, doc.y).lineTo(PAGE_RIGHT, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.5);
}

function drawTotals(doc, invoice) {
  const labelX = 380;
  const valueWidth = 165;

  doc.fontSize(10).font('Helvetica');
  doc.text('Subtotal', labelX, doc.y, { width: valueWidth - 75, align: 'left', continued: false });
  doc.text(formatMoney(invoice.subtotal), labelX, doc.y - doc.currentLineHeight(), { width: valueWidth, align: 'right' });

  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(12);
  doc.text('TOTAL', labelX, doc.y, { width: valueWidth - 75 });
  doc.text(formatMoney(invoice.total), labelX, doc.y - doc.currentLineHeight(), { width: valueWidth, align: 'right' });

  doc.moveDown(0.8);
}

function drawAmountInWords(doc, invoice) {
  doc.fontSize(10).font('Helvetica-Bold').text('Amount in Words:', PAGE_LEFT, doc.y);
  doc.font('Helvetica').text(invoice.amountInWords, PAGE_LEFT, doc.y, { width: PAGE_RIGHT - PAGE_LEFT });
  doc.moveDown(0.6);
}

function drawPayment(doc, invoice) {
  doc.font('Helvetica-Bold').fontSize(10).text('Payment:', PAGE_LEFT, doc.y, { continued: true });
  doc.font('Helvetica').text(` ${METHOD_LABELS[invoice.paymentMethod]} - ${STATUS_LABELS[invoice.paymentStatus]}`);
  doc.moveDown(0.6);
}

function drawFooter(doc, shopConfig) {
  doc.moveTo(PAGE_LEFT, doc.y).lineTo(PAGE_RIGHT, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.5);

  if (shopConfig.invoiceTerms) {
    doc.fontSize(8).font('Helvetica').fillColor('#555555').text(shopConfig.invoiceTerms, PAGE_LEFT, doc.y, {
      width: PAGE_RIGHT - PAGE_LEFT,
    });
    doc.fillColor('black');
    doc.moveDown(0.5);
  }

  doc.fontSize(10).font('Helvetica-Bold').text('Thank you for your business!', { align: 'center' });
}

function drawInvoice(doc, invoice, shopConfig) {
  drawHeader(doc, shopConfig);
  drawTitle(doc, invoice);
  drawInvoiceAndCustomerInfo(doc, invoice);
  drawItems(doc, invoice);
  drawTotals(doc, invoice);
  drawAmountInWords(doc, invoice);
  drawPayment(doc, invoice);
  drawFooter(doc, shopConfig);
}

/**
 * Renders a finalized (or cancelled) invoice to a PDF Buffer, entirely from
 * the invoice document already in hand — no Product/Customer lookups here,
 * so a later price or profile change can never alter a previously
 * generated PDF. Buffered in memory (single-page, small) rather than
 * streamed to disk — nothing is persisted, this is generated on demand and
 * discarded after the response.
 *
 * shopConfig is the invoice's OWN shop's identity (name/address/phone/
 * email/invoiceTerms) — the caller is responsible for loading it via
 * invoice.shopId, never via anything else, so one shop's PDF can never
 * render another shop's business identity.
 */
export function renderInvoicePdf(invoice, shopConfig) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      drawInvoice(doc, invoice, shopConfig);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function drawReportTitle(doc, { title, periodLabel, generatedAt }) {
  doc.fontSize(15).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(9).font('Helvetica').fillColor('#555555');
  doc.text(`Period: ${periodLabel}`, { align: 'center' });
  doc.text(`Generated: ${formatDate(generatedAt)}`, { align: 'center' });
  doc.fillColor('black');
  doc.moveDown(0.6);
}

/** Label/value pairs, same two-column same-row layout already used by drawTotals(). */
function drawReportSummary(doc, summary) {
  doc.fontSize(11).font('Helvetica-Bold').text('Summary', PAGE_LEFT, doc.y);
  doc.moveDown(0.3);

  summary.forEach(({ label, value }) => {
    const rowY = doc.y;
    doc.fontSize(10).font('Helvetica').text(label, PAGE_LEFT, rowY, { width: 300 });
    doc.font('Helvetica-Bold').text(value, PAGE_LEFT, rowY, { width: PAGE_RIGHT - PAGE_LEFT, align: 'right' });
    doc.moveDown(0.35);
  });

  doc.moveDown(0.3);
  doc.moveTo(PAGE_LEFT, doc.y).lineTo(PAGE_RIGHT, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.5);
}

/**
 * A generic column table — same per-row "capture one rowY, draw every
 * column at that same y, then moveDown once" technique already used by
 * drawItems() for invoice line items, just with caller-supplied columns
 * instead of the fixed product/qty/price/total set.
 */
function drawReportTable(doc, columns, rows) {
  const positions = [];
  let x = PAGE_LEFT;
  for (const col of columns) {
    positions.push(x);
    x += col.width;
  }

  function drawRow(cells, font, fontSize) {
    doc.font(font).fontSize(fontSize);
    const rowY = doc.y;
    columns.forEach((col, i) => {
      doc.text(cells[i], positions[i], rowY, { width: col.width, align: col.align || 'left' });
    });
    doc.moveDown(0.4);
  }

  drawRow(columns.map((c) => c.label), 'Helvetica-Bold', 10);
  doc.moveTo(PAGE_LEFT, doc.y).lineTo(PAGE_RIGHT, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.3);

  if (rows.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor('#777777').text('No matching records.', PAGE_LEFT, doc.y);
    doc.fillColor('black');
    doc.moveDown(0.4);
  } else {
    rows.forEach((row) => drawRow(columns.map((c) => String(row[c.key] ?? '')), 'Helvetica', 9));
  }

  doc.moveTo(PAGE_LEFT, doc.y).lineTo(PAGE_RIGHT, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.5);
}

/**
 * Renders a generic tabular billing report (bills/payments/sales/top
 * products/outstanding customers) to a PDF Buffer. Reuses the exact same
 * shop-identity header (drawHeader), money/date formatting, page-layout
 * constants, and per-row drawing technique as the invoice PDF above —
 * this is deliberately not a second PDF stack, just a second thing drawn
 * with the same one.
 *
 * `shopConfig` must be loaded via the report's own shopId, never anything
 * else — same rule as renderInvoicePdf, so one shop's report can never
 * carry another shop's business identity. `rows` is expected to already be
 * a bounded, report-service-decided page of data — this function does not
 * itself impose or know about any row limit.
 */
export function renderReportPdf({ shopConfig, title, periodLabel, generatedAt, summary = [], columns = [], rows = [], note }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      drawHeader(doc, shopConfig);
      drawReportTitle(doc, { title, periodLabel, generatedAt });
      if (summary.length > 0) drawReportSummary(doc, summary);
      if (columns.length > 0) drawReportTable(doc, columns, rows);
      if (note) {
        doc.fontSize(8).font('Helvetica').fillColor('#777777').text(note, PAGE_LEFT, doc.y, { width: PAGE_RIGHT - PAGE_LEFT });
        doc.fillColor('black');
      }
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
