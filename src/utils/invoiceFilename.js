const sanitizeInvoiceFilename = (invoiceNumber) => {
  const safeNumber = String(invoiceNumber || "invoice")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return `MoveKart-Invoice-${safeNumber || "invoice"}.pdf`;
};

module.exports = sanitizeInvoiceFilename;
