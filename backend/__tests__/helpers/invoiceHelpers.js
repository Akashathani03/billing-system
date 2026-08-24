import Customer from '../../models/Customer.js';
import Product from '../../models/Product.js';

export async function createFinalizedInvoice(agent, overrides = {}) {
  const customer = await Customer.create({
    name: overrides.customerName || 'Ramesh Kumar',
    mobile: overrides.customerMobile || '9876543210',
  });
  const product = await Product.create({
    name: overrides.productName || 'LED Bulb 9W',
    price: overrides.price ?? 150,
    unit: 'pcs',
  });

  const draftRes = await agent.post('/api/invoices').send({
    customerId: customer._id.toString(),
    items: [{ productId: product._id.toString(), quantity: overrides.quantity ?? 1 }],
    paymentMethod: overrides.paymentMethod || 'cash',
    paymentStatus: overrides.paymentStatus || 'paid',
  });

  const finalizeRes = await agent.post(`/api/invoices/${draftRes.body.invoice._id}/finalize`);
  return { invoice: finalizeRes.body.invoice, customer, product };
}
