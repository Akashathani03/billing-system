import Customer from '../models/Customer.js';
import { parsePagination, buildSearchRegex } from '../utils/pagination.js';

export async function searchCustomers(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};

  if (query.search?.trim()) {
    const regex = buildSearchRegex(query.search);
    filter.$or = [{ name: regex }, { mobile: regex }];
  }

  const [customers, total] = await Promise.all([
    Customer.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ]);

  return { customers, total, page, limit };
}

export async function createCustomer(data) {
  return Customer.create({
    name: data.name,
    mobile: data.mobile,
    address: data.address,
  });
}

export async function getCustomerById(id) {
  return Customer.findById(id);
}

export async function updateCustomer(id, data) {
  const update = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.mobile !== undefined) update.mobile = data.mobile;
  if (data.address !== undefined) update.address = data.address;

  return Customer.findByIdAndUpdate(id, update, { returnDocument: 'after', runValidators: true });
}
