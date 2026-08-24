import { amountToWords } from '../utils/amountInWords.js';

describe('amountToWords', () => {
  test('zero', () => {
    expect(amountToWords(0)).toBe('Zero Rupees');
  });

  test('a simple thousands amount', () => {
    expect(amountToWords(1593)).toBe('One Thousand Five Hundred Ninety Three Rupees');
  });

  test('includes paise when present', () => {
    expect(amountToWords(70.76)).toBe('Seventy Rupees and Seventy Six Paise');
  });

  test('handles lakh and crore', () => {
    expect(amountToWords(12345678)).toBe(
      'One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees',
    );
  });
});
