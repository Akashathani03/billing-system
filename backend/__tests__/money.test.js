import { toPaise, fromPaise, lineTotalPaise, taxAmountPaise } from '../utils/money.js';

describe('money utilities (rounding strategy)', () => {
  test('round-trips rupees to paise and back without drift', () => {
    expect(toPaise(100.01)).toBe(10001);
    expect(fromPaise(10001)).toBe(100.01);
  });

  test('computes exact line totals for decimal prices and quantities', () => {
    expect(fromPaise(lineTotalPaise(19.99, 3))).toBe(59.97);
    expect(fromPaise(lineTotalPaise(150, 2.5))).toBe(375);
  });

  test('computes tax with a single controlled rounding step', () => {
    const subtotalPaise = 5997; // 59.97
    expect(fromPaise(taxAmountPaise(subtotalPaise, 0.18))).toBe(10.79);
  });

  test('sums many decimal line items without accumulating floating-point drift', () => {
    const prices = [10.1, 20.2, 30.3, 5.05, 1.01];
    const totalPaise = prices.reduce((sum, p) => sum + toPaise(p), 0);
    expect(fromPaise(totalPaise)).toBe(66.66);
    expect(fromPaise(totalPaise)).not.toBe(66.66000000000001);
  });
});
