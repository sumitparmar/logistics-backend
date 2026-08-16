const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 42;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const COLORS = {
  navy: "#123B73",
  orange: "#F59E0B",
  ink: "#172033",
  muted: "#5D687A",
  border: "#D9E0EA",
  soft: "#F5F7FA",
  white: "#FFFFFF",
  success: "#087F5B",
};

const cleanText = (value, fallback = "-") => {
  const text = String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return text || fallback;
};

const formatMoney = (value, currency = "INR") => {
  const amount = Number(value || 0);
  const sign = amount < 0 ? "-" : "";
  const absolute = Math.abs(amount);
  return `${sign}${currency} ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absolute)}`;
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
};

const logoPath = () =>
  process.env.INVOICE_LOGO_PATH || path.resolve(__dirname, "../assets/movekart-logo.png");

const drawFooter = (doc, pageNumber = 1) => {
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text("MoveKart | System-generated invoice", MARGIN, PAGE.height - 30, {
      width: CONTENT_WIDTH - 70,
    })
    .text(`Page ${pageNumber}`, PAGE.width - MARGIN - 70, PAGE.height - 30, {
      width: 70,
      align: "right",
    });
};

const drawHeader = (doc, invoice) => {
  const business = invoice.businessSnapshot || {};
  const logo = logoPath();
  if (fs.existsSync(logo)) {
    doc.image(logo, MARGIN, 30, { fit: [175, 58], align: "left", valign: "center" });
  } else {
    doc.font("Helvetica-Bold").fontSize(20).fillColor(COLORS.navy).text(cleanText(business.legalName, "MoveKart"), MARGIN, 42);
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(17)
    .fillColor(COLORS.navy)
    .text(cleanText(business.invoiceTitle, "Invoice"), PAGE.width - MARGIN - 180, 34, {
      width: 180,
      align: "right",
    });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(`Invoice No. ${cleanText(invoice.invoiceNumber)}`, PAGE.width - MARGIN - 220, 59, {
      width: 220,
      align: "right",
    });
  doc
    .text(`Issue date ${formatDate(invoice.issueDate || invoice.createdAt)}`, PAGE.width - MARGIN - 220, 73, {
      width: 220,
      align: "right",
    });

  doc.moveTo(MARGIN, 102).lineTo(PAGE.width - MARGIN, 102).lineWidth(1).strokeColor(COLORS.border).stroke();

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(COLORS.ink)
    .text(cleanText(business.legalName, "MoveKart Logistics"), MARGIN, 112, {
      width: 260,
    });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(cleanText(business.registeredAddress, "Registered address not configured"), MARGIN, 126, {
      width: 290,
      height: 28,
    });
  const contact = [
    business.gstin ? `GSTIN: ${business.gstin}` : null,
    business.pan ? `PAN: ${business.pan}` : null,
    business.supportEmail ? `Support: ${business.supportEmail}` : null,
    business.supportPhone ? `Phone: ${business.supportPhone}` : null,
  ].filter(Boolean).join("  |  ");
  doc.text(cleanText(contact, "Support details not configured"), MARGIN, 154, {
    width: CONTENT_WIDTH,
  });
};

const drawSectionTitle = (doc, title, y) => {
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.navy).text(title, MARGIN, y);
  doc.moveTo(MARGIN, y + 17).lineTo(PAGE.width - MARGIN, y + 17).strokeColor(COLORS.border).stroke();
  return y + 27;
};

const drawKeyValue = (doc, label, value, x, y, width) => {
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted).text(label, x, y, { width: width * 0.38 });
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.ink).text(cleanText(value), x + width * 0.38, y, {
    width: width * 0.62,
    align: "right",
  });
};

const drawTableHeader = (doc, y) => {
  doc.rect(MARGIN, y, CONTENT_WIDTH, 22).fill(COLORS.navy);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.white);
  doc.text("Description", MARGIN + 8, y + 7, { width: 320 });
  doc.text("Amount", PAGE.width - MARGIN - 110, y + 7, { width: 102, align: "right" });
  return y + 29;
};

const generateInvoicePdf = (invoice) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: MARGIN, autoFirstPage: false });
      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      let y = 0;
      let pageNumber = 0;
      const startPage = () => {
        doc.addPage({ size: "A4", margin: MARGIN });
        pageNumber += 1;
        drawHeader(doc, invoice);
        y = 188;
      };
      const ensureSpace = (height, tableHeader = false) => {
        if (y + height <= PAGE.height - 58) return;
        drawFooter(doc, pageNumber);
        startPage();
        if (tableHeader) y = drawTableHeader(doc, y);
      };

      startPage();
      const customer = invoice.customerSnapshot || {};
      const delivery = invoice.deliverySnapshot || {};
      const payment = invoice.paymentSnapshot || {};
      const business = invoice.businessSnapshot || {};
      const currency = invoice.currency || business.currency || "INR";

      y = drawSectionTitle(doc, "Bill to", y);
      ensureSpace(60);
      doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 62, 5).fill(COLORS.soft);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.ink).text(cleanText(customer.billingName || customer.name), MARGIN + 12, y + 10);
      doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted).text(cleanText(customer.email), MARGIN + 12, y + 25, { width: 240 });
      doc.text(cleanText(customer.phone), MARGIN + 12, y + 39, { width: 240 });
      const billing = [customer.billingAddress, customer.state ? `${customer.state}${customer.stateCode ? ` (${customer.stateCode})` : ""}` : null].filter(Boolean).join(", ");
      doc.text(cleanText(billing, "Billing address not provided"), MARGIN + 278, y + 16, { width: 220, height: 34, align: "right" });
      y += 82;

      y = drawSectionTitle(doc, "Delivery details", y);
      ensureSpace(80);
      const pickup = delivery.pickup?.address || delivery.stops?.find((stop) => stop.type === "PICKUP")?.address;
      const drop = delivery.drop?.address || delivery.stops?.find((stop) => stop.type === "DROP")?.address;
      drawKeyValue(doc, "Order reference", delivery.orderReference, MARGIN, y, CONTENT_WIDTH / 2 - 8);
      drawKeyValue(doc, "Booking date", formatDate(delivery.bookingDate), PAGE.width / 2 + 4, y, CONTENT_WIDTH / 2 - 8);
      y += 17;
      drawKeyValue(doc, "Pickup", pickup, MARGIN, y, CONTENT_WIDTH / 2 - 8);
      drawKeyValue(doc, "Delivered", formatDate(delivery.deliveredDate), PAGE.width / 2 + 4, y, CONTENT_WIDTH / 2 - 8);
      y += 17;
      drawKeyValue(doc, "Drop", drop, MARGIN, y, CONTENT_WIDTH / 2 - 8);
      drawKeyValue(doc, "Service type", delivery.deliveryType, PAGE.width / 2 + 4, y, CONTENT_WIDTH / 2 - 8);
      y += 17;
      drawKeyValue(doc, "Vehicle type", delivery.vehicleTypeId, MARGIN, y, CONTENT_WIDTH / 2 - 8);
      drawKeyValue(doc, "Package", delivery.package?.description || delivery.package?.category, PAGE.width / 2 + 4, y, CONTENT_WIDTH / 2 - 8);
      y += 32;

      y = drawSectionTitle(doc, "Charges", y);
      y = drawTableHeader(doc, y);
      for (const item of invoice.lineItems || []) {
        const label = cleanText(item.label);
        const rowHeight = Math.max(22, doc.heightOfString(label, { width: 320 }) + 12);
        ensureSpace(rowHeight, true);
        if (y % 2 > 0) doc.rect(MARGIN, y - 5, CONTENT_WIDTH, rowHeight).fill("#FBFCFE");
        doc.font("Helvetica").fontSize(8).fillColor(COLORS.ink).text(label, MARGIN + 8, y + 3, { width: 320 });
        doc.text(formatMoney(item.amount, currency), PAGE.width - MARGIN - 110, y + 3, { width: 102, align: "right" });
        y += rowHeight;
      }

      ensureSpace(125);
      doc.moveTo(MARGIN, y).lineTo(PAGE.width - MARGIN, y).strokeColor(COLORS.border).stroke();
      y += 14;
      drawKeyValue(doc, "Taxable subtotal", formatMoney(invoice.taxableSubtotal ?? invoice.subtotal, currency), PAGE.width / 2 + 4, y, CONTENT_WIDTH / 2 - 8);
      y += 18;
      const tax = invoice.taxBreakdown || {};
      if (tax.type === "INTRA_STATE") {
        drawKeyValue(doc, `CGST ${tax.rate / 2}%`, formatMoney(tax.cgst, currency), PAGE.width / 2 + 4, y, CONTENT_WIDTH / 2 - 8);
        y += 18;
        drawKeyValue(doc, `SGST ${tax.rate / 2}%`, formatMoney(tax.sgst, currency), PAGE.width / 2 + 4, y, CONTENT_WIDTH / 2 - 8);
        y += 18;
      } else if (tax.type === "INTER_STATE") {
        drawKeyValue(doc, `IGST ${tax.rate}%`, formatMoney(tax.igst, currency), PAGE.width / 2 + 4, y, CONTENT_WIDTH / 2 - 8);
        y += 18;
      } else {
        drawKeyValue(doc, `GST ${tax.rate || 0}%`, formatMoney(invoice.tax || tax.total, currency), PAGE.width / 2 + 4, y, CONTENT_WIDTH / 2 - 8);
        y += 18;
      }
      if (Number(invoice.roundingAdjustment || 0) !== 0) {
        drawKeyValue(doc, "Rounding adjustment", formatMoney(invoice.roundingAdjustment, currency), PAGE.width / 2 + 4, y, CONTENT_WIDTH / 2 - 8);
        y += 18;
      }
      doc.roundedRect(PAGE.width / 2 + 4, y, CONTENT_WIDTH / 2 - 4, 34, 4).fill(COLORS.navy);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.white).text("Grand total", PAGE.width / 2 + 16, y + 11);
      doc.text(formatMoney(invoice.grandTotal ?? invoice.total, currency), PAGE.width - MARGIN - 110, y + 11, { width: 102, align: "right" });
      y += 52;

      ensureSpace(80);
      y = drawSectionTitle(doc, "Payment", y);
      drawKeyValue(doc, "Method", payment.method, MARGIN, y, CONTENT_WIDTH / 2 - 8);
      drawKeyValue(doc, "Status", payment.status, PAGE.width / 2 + 4, y, CONTENT_WIDTH / 2 - 8);
      y += 18;
      drawKeyValue(doc, "Amount paid", formatMoney(invoice.amountPaid, currency), MARGIN, y, CONTENT_WIDTH / 2 - 8);
      drawKeyValue(doc, "Amount due", formatMoney(invoice.amountDue, currency), PAGE.width / 2 + 4, y, CONTENT_WIDTH / 2 - 8);
      y += 33;
      doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted).text(`Amount in words: ${cleanText(invoice.amountInWords)}`, MARGIN, y, { width: CONTENT_WIDTH });
      y += 24;

      ensureSpace(60);
      doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 48, 5).fill("#FFF8E7");
      doc.font("Helvetica").fontSize(8).fillColor(COLORS.ink).text(
        `Delivery status: ${cleanText(delivery.status, "DELIVERED")}. This system-generated invoice reflects the immutable MoveKart order and pricing snapshot recorded at issue time.`,
        MARGIN + 12,
        y + 12,
        { width: CONTENT_WIDTH - 24, height: 28 },
      );
      drawFooter(doc, pageNumber);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });

module.exports = generateInvoicePdf;
