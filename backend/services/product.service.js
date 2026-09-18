import Product from '../models/Product.js';
import { parsePagination, buildSearchRegex } from '../utils/pagination.js';

export async function searchProducts(query, shopId) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { shopId };

  if (!query.includeInactive || query.includeInactive === 'false') {
    filter.isActive = true;
  }

  if (query.search?.trim()) {
    filter.name = buildSearchRegex(query.search);
  }

  const [products, total] = await Promise.all([
    Product.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  return { products, total, page, limit };
}

export async function createProduct(data, shopId) {
  return Product.create({
    shopId,
    name: data.name,
    price: data.price,
    unit: data.unit,
  });
}

export async function getProductById(id, shopId) {
  return Product.findOne({ _id: id, shopId });
}

export async function updateProduct(id, data, shopId) {
  const update = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.price !== undefined) update.price = data.price;
  if (data.unit !== undefined) update.unit = data.unit;
  if (data.isActive !== undefined) update.isActive = data.isActive;

  return Product.findOneAndUpdate({ _id: id, shopId }, update, { returnDocument: 'after', runValidators: true });
}
