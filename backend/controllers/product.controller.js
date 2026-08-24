import * as productService from '../services/product.service.js';

export async function list(req, res) {
  const result = await productService.searchProducts(req.query);
  res.json(result);
}

export async function create(req, res) {
  const product = await productService.createProduct(req.body);
  res.status(201).json({ product });
}

export async function getOne(req, res) {
  const product = await productService.getProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ error: { message: 'Product not found', code: 'NOT_FOUND' } });
  }
  res.json({ product });
}

export async function update(req, res) {
  const product = await productService.updateProduct(req.params.id, req.body);
  if (!product) {
    return res.status(404).json({ error: { message: 'Product not found', code: 'NOT_FOUND' } });
  }
  res.json({ product });
}
