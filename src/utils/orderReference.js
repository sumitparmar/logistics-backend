const NUMERIC_REFERENCE_LENGTH = 6;
const NUMERIC_REFERENCE_MODULUS = 10 ** NUMERIC_REFERENCE_LENGTH;

// Provider and database identifiers stay private. This stable reference is
// intended for customer-facing messages, invoices and support conversations.
const getOrderReference = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "000000";

  const digits = raw.replace(/\D/g, "");
  if (digits) {
    return digits.slice(-NUMERIC_REFERENCE_LENGTH).padStart(
      NUMERIC_REFERENCE_LENGTH,
      "0",
    );
  }

  let hash = 0;
  for (const character of raw) {
    hash = (hash * 31 + character.charCodeAt(0)) % NUMERIC_REFERENCE_MODULUS;
  }

  return String(hash).padStart(NUMERIC_REFERENCE_LENGTH, "0");
};

module.exports = { getOrderReference };
