const BELOW_TWENTY = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

const underThousand = (value) => {
  const parts = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  if (hundreds) parts.push(`${BELOW_TWENTY[hundreds]} hundred`);
  if (remainder < 20 && remainder) parts.push(BELOW_TWENTY[remainder]);
  if (remainder >= 20) {
    parts.push(TENS[Math.floor(remainder / 10)]);
    if (remainder % 10) parts.push(BELOW_TWENTY[remainder % 10]);
  }
  return parts.join(" ");
};

const amountInWords = (amount, currency = "INR") => {
  const value = Number(Number(amount || 0).toFixed(2));
  const integer = Math.floor(value);
  const paise = Math.round((value - integer) * 100);
  if (integer === 0 && paise === 0) return `${currency} zero only`;

  const parts = [];
  let remaining = integer;
  const crore = Math.floor(remaining / 10000000);
  remaining %= 10000000;
  const lakh = Math.floor(remaining / 100000);
  remaining %= 100000;
  const thousand = Math.floor(remaining / 1000);
  remaining %= 1000;

  if (crore) parts.push(`${underThousand(crore)} crore`);
  if (lakh) parts.push(`${underThousand(lakh)} lakh`);
  if (thousand) parts.push(`${underThousand(thousand)} thousand`);
  if (remaining) parts.push(underThousand(remaining));

  const result = `${currency} ${parts.join(" ") || "zero"}`;
  return paise ? `${result} and ${underThousand(paise)} paise only` : `${result} only`;
};

module.exports = amountInWords;
