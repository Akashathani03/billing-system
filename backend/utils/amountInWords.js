const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const TEENS = [
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
  'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertTens(n) {
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  return TENS[Math.floor(n / 10)] + (n % 10 !== 0 ? ` ${ONES[n % 10]}` : '');
}

function convertHundreds(n) {
  if (n > 99) {
    return `${ONES[Math.floor(n / 100)]} Hundred ${convertTens(n % 100)}`.trim();
  }
  return convertTens(n);
}

/** Converts a rupee amount (Number, e.g. 1593.50) to Indian-numbering words. */
export function amountToWords(amount) {
  let rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let result = '';

  if (rupees > 0) {
    if (rupees >= 10000000) {
      result += `${convertHundreds(Math.floor(rupees / 10000000))} Crore `;
      rupees %= 10000000;
    }
    if (rupees >= 100000) {
      result += `${convertHundreds(Math.floor(rupees / 100000))} Lakh `;
      rupees %= 100000;
    }
    if (rupees >= 1000) {
      result += `${convertHundreds(Math.floor(rupees / 1000))} Thousand `;
      rupees %= 1000;
    }
    if (rupees > 0) {
      result += `${convertHundreds(rupees)} `;
    }
    result += 'Rupees';
  } else {
    result += 'Zero Rupees';
  }

  if (paise > 0) {
    result += ` and ${convertTens(paise)} Paise`;
  }

  return result.trim();
}
