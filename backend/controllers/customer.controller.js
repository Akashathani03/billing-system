import * as customerService from '../services/customer.service.js';
import * as invoiceService from '../services/invoice.service.js';

export async function list(req, res) {
  const result = await customerService.searchCustomers(req.query, req.user.shopId);
  res.json(result);
}

export async function create(req, res) {
  const customer = await customerService.createCustomer(req.body, req.user.shopId);
  res.status(201).json({ customer });
}

export async function getOne(req, res) {
  const customer = await customerService.getCustomerById(req.params.id, req.user.shopId);
  if (!customer) {
    return res.status(404).json({ error: { message: 'Customer not found', code: 'NOT_FOUND' } });
  }
  res.json({ customer });
}

export async function update(req, res) {
  const customer = await customerService.updateCustomer(req.params.id, req.body, req.user.shopId);
  if (!customer) {
    return res.status(404).json({ error: { message: 'Customer not found', code: 'NOT_FOUND' } });
  }
  res.json({ customer });
}

export async function getInvoiceHistory(req, res) {
  const customer = await customerService.getCustomerById(req.params.id, req.user.shopId);
  if (!customer) {
    return res.status(404).json({ error: { message: 'Customer not found', code: 'NOT_FOUND' } });
  }
  const result = await invoiceService.getInvoicesByCustomer(req.params.id, req.query, req.user.shopId);
  res.json(result);
}
