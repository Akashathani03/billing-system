import * as invoiceService from '../services/invoice.service.js';

export async function create(req, res) {
  const invoice = await invoiceService.createDraftInvoice({
    customerId: req.body.customerId,
    items: req.body.items,
    paymentMethod: req.body.paymentMethod,
    paymentStatus: req.body.paymentStatus,
    createdBy: req.user.id,
  });
  res.status(201).json({ invoice });
}

export async function list(req, res) {
  const result = await invoiceService.listInvoices(req.query);
  res.json(result);
}

export async function getOne(req, res) {
  const invoice = await invoiceService.getInvoiceById(req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: { message: 'Invoice not found', code: 'NOT_FOUND' } });
  }
  res.json({ invoice });
}

export async function update(req, res) {
  const invoice = await invoiceService.updateDraftInvoice(req.params.id, {
    customerId: req.body.customerId,
    items: req.body.items,
    paymentMethod: req.body.paymentMethod,
    paymentStatus: req.body.paymentStatus,
  });
  if (!invoice) {
    return res.status(404).json({ error: { message: 'Invoice not found', code: 'NOT_FOUND' } });
  }
  res.json({ invoice });
}

export async function finalize(req, res) {
  const invoice = await invoiceService.finalizeInvoice(req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: { message: 'Invoice not found', code: 'NOT_FOUND' } });
  }
  res.json({ invoice });
}

export async function updatePaymentStatus(req, res) {
  const invoice = await invoiceService.updatePaymentStatus(req.params.id, {
    newStatus: req.body.paymentStatus,
    changedBy: req.user.id,
  });
  if (!invoice) {
    return res.status(404).json({ error: { message: 'Invoice not found', code: 'NOT_FOUND' } });
  }
  res.json({ invoice });
}
