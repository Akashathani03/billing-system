import {
  getDashboardSummary,
  getMonthlySales,
  getMonthlySalesForYear,
  getAvailableSalesYears,
} from '../services/dashboard.service.js';

export async function summary(req, res) {
  const data = await getDashboardSummary(req.user.shopId);
  res.json(data);
}

export async function monthlySales(req, res) {
  const data = req.query.year
    ? await getMonthlySalesForYear(Number(req.query.year), req.user.shopId)
    : await getMonthlySales(req.user.shopId);
  res.json(data);
}

export async function salesYears(req, res) {
  const data = await getAvailableSalesYears(req.user.shopId);
  res.json(data);
}
