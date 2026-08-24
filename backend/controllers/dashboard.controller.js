import { getDashboardSummary } from '../services/dashboard.service.js';

export async function summary(req, res) {
  const data = await getDashboardSummary();
  res.json(data);
}
