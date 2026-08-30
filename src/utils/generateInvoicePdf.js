const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const vehicleTypes = require("../constants/vehicleTypes");

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 30;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const GUTTER = 14;
const COLUMN_WIDTH = (CONTENT_WIDTH - GUTTER) / 2;
const COLORS = {
  navy: "#123B73",
  blue: "#2563EB",
  orange: "#F59E0B",
  green: "#2BBF3D",
  red: "#F35B5B",
  ink: "#252A34",
  muted: "#6B7280",
  border: "#E5E7EB",
  soft: "#F7F8FA",
  white: "#FFFFFF",
};

const cleanText = (value, fallback = "-") => {
  const text = String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
  return text || fallback;
};

const formatMoney = (value, currency = "INR") => {
  const amount = Number(value || 0);
  const sign = amount < 0 ? "-" : "";
  return `${sign}${currency} ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))}`;
};

const formatDate = (value, includeTime = false) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", hour12: true } : {}),
    timeZone: "Asia/Kolkata",
  }).format(date);
};

const logoPath = () =>
  process.env.INVOICE_LOGO_PATH || path.resolve(__dirname, "../assets/movekart-logo.png");

const illustrationPath = () =>
  process.env.INVOICE_ILLUSTRATION_PATH ||
  path.resolve(__dirname, "../assets/movekart-delivery-illustration.png");

const getStops = (delivery) => {
  const stops = Array.isArray(delivery.stops) ? delivery.stops : [];
  return {
    pickup: stops.find((stop) => stop.type === "PICKUP") || delivery.pickup || {},
    drop: stops.find((stop) => stop.type === "DROP") || delivery.drop || {},
  };
};

const getVehicleLabel = (value) => {
  const vehicle = vehicleTypes.find((item) => String(item.id) === String(value));
  return vehicle?.name || (value ? `Vehicle ${value}` : "Vehicle not recorded");
};

const drawFooter = (doc, business, pageNumber) => {
  const contact = [business.supportEmail, business.supportPhone].filter(Boolean).join(" | ");
  doc
    .moveTo(MARGIN, PAGE.height - 36)
    .lineTo(PAGE.width - MARGIN, PAGE.height - 36)
    .lineWidth(0.6)
    .strokeColor(COLORS.border)
    .stroke();
  doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.muted);
  doc.text(cleanText(contact, "MoveKart support"), MARGIN, PAGE.height - 27, {
    width: CONTENT_WIDTH - 55,
  });
  doc.text(`Page ${pageNumber}`, PAGE.width - MARGIN - 55, PAGE.height - 27, {
    width: 55,
    align: "right",
  });
};

const drawLogo = (doc, x, y, width, height, business) => {
  const logo = logoPath();
  if (fs.existsSync(logo)) {
    doc.image(logo, x, y, { fit: [width, height], align: "left", valign: "center" });
    return;
  }
  doc.font("Helvetica-Bold").fontSize(22).fillColor(COLORS.navy).text(
    cleanText(business.legalName, "MoveKart"),
    x,
    y + 15,
    { width },
  );
};

// Original MoveKart artwork keeps the reference's delivery-story layout without
// importing third-party branding or artwork into customer invoices.
const drawDeliveryIllustration = (doc, x, y, width, height) => {
  const artwork = illustrationPath();
  if (fs.existsSync(artwork)) {
    doc.image(artwork, x, y, { fit: [width, height], align: "center", valign: "center" });
    return;
  }

  doc.save();
  doc.roundedRect(x, y, width, height, 10).fill(COLORS.white);
  doc.circle(x + width / 2, y + height * 0.48, Math.min(width, height) * 0.34).fill("#DCE7FF");
  doc.strokeColor("#C6CBD3").lineWidth(1.1).moveTo(x + 10, y + height * 0.66).lineTo(x + width - 10, y + height * 0.66).stroke();

  const tree = (tx, ty, scale) => {
    doc.fillColor("#D0D4DA").rect(tx - 1.5 * scale, ty, 3 * scale, 18 * scale).fill();
    doc.circle(tx, ty - 8 * scale, 10 * scale).fill("#D0D4DA");
  };
  tree(x + width * 0.2, y + height * 0.57, 0.65);
  tree(x + width * 0.82, y + height * 0.58, 0.75);

  const vanX = x + width * 0.3;
  const vanY = y + height * 0.52;
  const vanW = width * 0.35;
  const vanH = height * 0.19;
  doc.fillColor("#173EAF").roundedRect(vanX, vanY, vanW, vanH, 3).fill();
  doc.fillColor("#F9B233").rect(vanX + vanW * 0.58, vanY + vanH * 0.2, vanW * 0.33, vanH * 0.48).fill();
  doc.fillColor("#B9C1CB").rect(vanX + 5, vanY - vanH * 0.55, vanW * 0.53, vanH * 0.55).fill();
  doc.strokeColor("#111827").lineWidth(1).rect(vanX + 5, vanY - vanH * 0.55, vanW * 0.53, vanH * 0.55).stroke();
  doc.fillColor("#111827").circle(vanX + vanW * 0.2, vanY + vanH, 5).fill();
  doc.fillColor("#111827").circle(vanX + vanW * 0.78, vanY + vanH, 5).fill();

  const bikeX = x + width * 0.58;
  const bikeY = y + height * 0.48;
  doc.strokeColor(COLORS.blue).lineWidth(2).circle(bikeX, bikeY + 17, 7).stroke();
  doc.circle(bikeX + 27, bikeY + 17, 7).stroke();
  doc.moveTo(bikeX, bikeY + 17).lineTo(bikeX + 11, bikeY + 5).lineTo(bikeX + 27, bikeY + 17).lineTo(bikeX + 17, bikeY + 17).lineTo(bikeX + 11, bikeY + 5).stroke();
  doc.fillColor(COLORS.orange).circle(bikeX + 13, bikeY - 2, 4).fill();
  doc.restore();
};

const drawCard = (doc, x, y, width, height, fill = COLORS.soft, radius = 10) => {
  doc.roundedRect(x, y, width, height, radius).fill(fill);
};

const drawLabel = (doc, label, x, y, width) => {
  doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.muted).text(label.toUpperCase(), x, y, { width });
};

const drawValue = (doc, value, x, y, width, options = {}) => {
  doc
    .font(options.bold === false ? "Helvetica" : "Helvetica-Bold")
    .fontSize(options.size || 8.5)
    .fillColor(options.color || COLORS.ink)
    .text(cleanText(value), x, y, {
      width,
      height: options.height,
      align: options.align || "left",
      ellipsis: options.ellipsis === true,
    });
};

const drawField = (doc, label, value, x, y, width) => {
  drawLabel(doc, label, x, y, width);
  drawValue(doc, value, x, y + 12, width, { size: 8.5 });
};

const drawInlineField = (doc, label, value, x, y, width) => {
  const labelWidth = Math.min(112, width * 0.48);
  doc.font("Helvetica").fontSize(7.2).fillColor(COLORS.muted).text(label.toUpperCase(), x, y, {
    width: labelWidth,
    height: 16,
    ellipsis: true,
  });
  drawValue(doc, value, x + labelWidth + 8, y, width - labelWidth - 8, { size: 8.2 });
};

const sumLineItems = (items, predicate) =>
  (items || []).reduce((sum, item) => (predicate(item) ? sum + Number(item.amount || 0) : sum), 0);

const drawFareCard = (doc, invoice, x, y, width, height, currency) => {
  drawCard(doc, x, y, width, height, COLORS.soft, 10);
  const items = invoice.lineItems || [];
  const administrativeCodes = new Set(["SERVICE_MARGIN", "PLATFORM_FEE", "HANDLING_FEE", "PRICING_ADJUSTMENT", "ROUNDING"]);
  const tripFare = sumLineItems(items, (item) => !administrativeCodes.has(item.code) && Number(item.amount || 0) > 0);
  const discount = sumLineItems(items, (item) => Number(item.amount || 0) < 0);
  const subtotal = invoice.taxableSubtotal ?? invoice.subtotal ?? invoice.total;
  const tax = invoice.taxBreakdown || {};
  const total = invoice.grandTotal ?? invoice.total;
  let rowY = y + 18;

  drawValue(doc, "Total Amount", x + 18, rowY, width - 36, { size: 12 });
  drawValue(doc, formatMoney(total, currency), x + 18, rowY, width - 36, { size: 11, align: "right" });
  rowY += 30;
  doc.moveTo(x + 18, rowY).lineTo(x + width - 18, rowY).strokeColor(COLORS.border).stroke();
  rowY += 17;

  const fareRow = (label, value, color = COLORS.ink) => {
    drawValue(doc, label, x + 18, rowY, width * 0.55, { bold: false, size: 8.5, color });
    drawValue(doc, value, x + width - 18 - width * 0.38, rowY, width * 0.38, { size: 8.5, color, align: "right" });
    rowY += 20;
  };
  fareRow("Trip fare", formatMoney(tripFare, currency));
  if (Math.abs(discount) >= 0.01) fareRow("Discount", formatMoney(discount, currency), COLORS.green);
  doc.moveTo(x + 18, rowY - 7).lineTo(x + width - 18, rowY - 7).strokeColor(COLORS.border).stroke();
  fareRow("Sub Total", formatMoney(subtotal, currency));
  if (Math.abs(Number(invoice.roundingAdjustment || 0)) >= 0.01) {
    fareRow("Rounding", formatMoney(invoice.roundingAdjustment, currency));
  }
  if (Math.abs(Number(invoice.tax || tax.total || 0)) >= 0.01) {
    const taxLabel = tax.type === "INTER_STATE" ? `IGST ${tax.rate || 0}%` : `GST ${tax.rate || 0}%`;
    fareRow(taxLabel, formatMoney(invoice.tax || tax.total, currency));
  }
  doc.moveTo(x + 18, rowY - 7).lineTo(x + width - 18, rowY - 7).strokeColor(COLORS.border).stroke();
  drawValue(doc, "Net fare", x + 18, rowY + 8, width * 0.52, { size: 10 });
  drawValue(doc, formatMoney(total, currency), x + width - 18 - width * 0.42, rowY + 8, width * 0.42, { size: 10, align: "right" });
  drawCard(doc, x + 18, y + height - 38, width - 36, 24, "#ECEDEF", 14);
  drawValue(doc, "MoveKart delivery completed at the recorded fare", x + 28, y + height - 30, width - 56, { bold: false, size: 7.5, align: "center" });
};

const drawRoute = (doc, delivery, x, y, width) => {
  const { pickup, drop } = getStops(delivery);
  const vehicle = getVehicleLabel(delivery.vehicleTypeId);
  drawCard(doc, x, y, width, 28, "#EAF0FF", 14);
  drawValue(doc, vehicle, x + 12, y + 9, width - 24, { size: 8.5, color: COLORS.blue });

  const columns = [
    { x, color: COLORS.green, title: "Pickup location", data: pickup, time: delivery.bookingDate },
    { x: x + width / 2, color: COLORS.red, title: "Drop location", data: drop, time: delivery.deliveredDate },
  ];
  columns.forEach(({ x: columnX, color, title, data, time }) => {
    const dotX = columnX + 3;
    doc.fillColor(color).circle(dotX, y + 46, 4).fill();
    doc.moveTo(dotX + 8, y + 46).lineTo(columnX + width / 2 - 12, y + 46).dash(2, { space: 2 }).strokeColor(COLORS.border).stroke();
    drawLabel(doc, title, columnX, y + 60, width / 2 - 12);
    drawValue(doc, formatDate(time, true), columnX, y + 73, width / 2 - 12, { size: 7.8 });
    drawValue(doc, data.address, columnX, y + 88, width / 2 - 12, { bold: false, size: 7.6, height: 48, ellipsis: true });
  });
};

const generateInvoicePdf = (invoice) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false });
      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      const customer = invoice.customerSnapshot || {};
      const delivery = invoice.deliverySnapshot || {};
      const payment = invoice.paymentSnapshot || {};
      const business = invoice.businessSnapshot || {};
      const currency = invoice.currency || business.currency || "INR";
      const { drop } = getStops(delivery);
      const packageData = delivery.package || {};
      const consigneeName = drop.name || "Not available";
      const goodsType = packageData.category || packageData.description || "Not recorded";
      const packageCount = packageData.packages || packageData.quantity || packageData.count || "Not recorded";
      const packageValue = packageData.declaredValue ?? "Not declared";
      const title = cleanText(
        business.invoiceTitle,
        Number(invoice.tax || invoice.taxBreakdown?.total || 0) > 0
          ? "Tax Invoice/ Consignment Note"
          : "Bill of Supply/ Consignment Note",
      );

      doc.addPage({ size: "A4", margin: 0 });
      drawLogo(doc, MARGIN, 42, 165, 40, business);
      drawValue(doc, title, MARGIN, 30, CONTENT_WIDTH, { size: 15, align: "center" });
      drawValue(doc, "Invoice number", PAGE.width - MARGIN - 175, 57, 75, { size: 8, align: "right" });
      drawValue(doc, invoice.invoiceNumber, PAGE.width - MARGIN - 95, 57, 95, { bold: false, size: 8, align: "right" });
      drawValue(doc, "Issue date", PAGE.width - MARGIN - 175, 73, 75, { size: 8, align: "right" });
      drawValue(doc, formatDate(invoice.issueDate || invoice.createdAt), PAGE.width - MARGIN - 95, 73, 95, { bold: false, size: 8, align: "right" });
      doc.moveTo(MARGIN, 94).lineTo(PAGE.width - MARGIN, 94).strokeColor(COLORS.border).stroke();

      const topY = 108;
      drawDeliveryIllustration(doc, MARGIN, topY, COLUMN_WIDTH, 168);
      drawFareCard(doc, invoice, MARGIN + COLUMN_WIDTH + GUTTER, topY, COLUMN_WIDTH, 220, currency);
      drawValue(doc, "Thank you for choosing MoveKart.", MARGIN, 286, COLUMN_WIDTH, { size: 13, color: COLORS.blue, align: "center" });
      drawValue(doc, "We are glad to serve you!", MARGIN, 305, COLUMN_WIDTH, { size: 12, align: "center" });

      const leftX = MARGIN;
      const rightX = MARGIN + COLUMN_WIDTH + GUTTER;
      const customerCardY = 334;
      drawCard(doc, leftX, customerCardY, COLUMN_WIDTH, 108);
      drawInlineField(doc, "Consignor name", customer.name, leftX + 12, customerCardY + 14, COLUMN_WIDTH - 24);
      drawInlineField(doc, "Customer registered name", customer.billingName, leftX + 12, customerCardY + 34, COLUMN_WIDTH - 24);
      drawInlineField(doc, "GSTIN", customer.gstin, leftX + 12, customerCardY + 54, COLUMN_WIDTH - 24);
      drawInlineField(doc, "Place of supply", customer.state, leftX + 12, customerCardY + 74, COLUMN_WIDTH - 24);

      drawRoute(doc, delivery, rightX, 334, COLUMN_WIDTH);

      drawCard(doc, leftX, 454, COLUMN_WIDTH, 52);
      drawInlineField(doc, "Consignee name", consigneeName, leftX + 12, 466, COLUMN_WIDTH - 24);

      drawCard(doc, leftX, 518, COLUMN_WIDTH, 86);
      drawLabel(doc, "Goods type", leftX + 12, 532, COLUMN_WIDTH - 24);
      drawValue(doc, goodsType, leftX + 12, 545, COLUMN_WIDTH - 24, { size: 8.2, height: 16, ellipsis: true });
      const metricWidth = (COLUMN_WIDTH - 36) / 3;
      drawField(doc, "Weight", packageData.weight ? `${packageData.weight} kg` : "Not recorded", leftX + 12, 568, metricWidth);
      drawField(doc, "Packages", packageCount, leftX + 12 + metricWidth + 6, 568, metricWidth);
      drawField(doc, "Declared value", packageValue === "Not declared" ? packageValue : formatMoney(packageValue, currency), leftX + 12 + (metricWidth + 6) * 2, 568, metricWidth);

      drawCard(doc, rightX, 454, COLUMN_WIDTH, 150, COLORS.white, 0);
      drawValue(doc, "Payment", rightX, 454, COLUMN_WIDTH, { size: 10, color: COLORS.navy });
      doc.moveTo(rightX, 472).lineTo(rightX + COLUMN_WIDTH, 472).strokeColor(COLORS.border).stroke();
      drawField(doc, "Method", payment.method, rightX, 484, COLUMN_WIDTH / 2 - 6);
      drawField(doc, "Status", payment.status, rightX + COLUMN_WIDTH / 2 + 6, 484, COLUMN_WIDTH / 2 - 6);
      drawField(doc, "Amount paid", formatMoney(invoice.amountPaid, currency), rightX, 524, COLUMN_WIDTH / 2 - 6);
      drawField(doc, "Amount due", formatMoney(invoice.amountDue, currency), rightX + COLUMN_WIDTH / 2 + 6, 524, COLUMN_WIDTH / 2 - 6);
      drawLabel(doc, "Amount in words", rightX, 564, COLUMN_WIDTH);
      drawValue(doc, invoice.amountInWords, rightX, 577, COLUMN_WIDTH, { bold: false, size: 7.5, height: 20, ellipsis: true });

      const declarationY = 634;
      const declarationHeight = 157;
      drawCard(doc, MARGIN, declarationY - 8, CONTENT_WIDTH, declarationHeight, COLORS.soft, 10);
      doc.roundedRect(MARGIN, declarationY - 8, CONTENT_WIDTH, declarationHeight, 10)
        .lineWidth(0.7)
        .strokeColor(COLORS.border)
        .stroke();
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.navy).text("MoveKart Declaration", MARGIN + 24, declarationY + 4);
      doc.roundedRect(MARGIN + 14, declarationY + 4, 3, 11, 1.5).fill(COLORS.orange);
      doc.moveTo(MARGIN + 14, declarationY + 23).lineTo(PAGE.width - MARGIN - 14, declarationY + 23).strokeColor(COLORS.border).stroke();
      const declarations = [
        `1. This computer-generated document is issued by MoveKart from the order and pricing record stored at delivery.`,
        `2. Consignment, consignor and consignee information is based on details provided during booking and delivery.`,
        `3. Charges, discounts, taxes and payment status are shown from the immutable issued-invoice snapshot.`,
      ];
      declarations.forEach((text, index) => {
        const rowY = declarationY + 31 + index * 14;
        doc.circle(MARGIN + 21, rowY + 4, 5.5).fill(COLORS.blue);
        doc.font("Helvetica-Bold").fontSize(6.5).fillColor(COLORS.white).text(String(index + 1), MARGIN + 18.9, rowY + 0.6, { width: 4.5, align: "center" });
        drawValue(doc, text.replace(/^\d+\.\s*/, ""), MARGIN + 34, rowY, CONTENT_WIDTH - 48, { bold: false, size: 7.2, height: 12, ellipsis: true });
      });

      const issuerY = declarationY + 80;
      doc.moveTo(MARGIN + 14, issuerY - 7).lineTo(PAGE.width - MARGIN - 14, issuerY - 7).strokeColor(COLORS.border).stroke();
      doc.font("Helvetica-Bold").fontSize(6.7).fillColor(COLORS.muted).text("ISSUED BY", MARGIN + 14, issuerY);
      drawValue(doc, cleanText(business.legalName, "MoveKart Logistics"), MARGIN + 14, issuerY + 11, CONTENT_WIDTH - 28, { size: 7.8, height: 12 });

      const issuerDetails = [
        business.registeredAddress,
        business.gstin && `GSTIN: ${business.gstin}`,
        business.pan && `PAN: ${business.pan}`,
        business.sacCode && `SAC: ${business.sacCode}`,
      ].filter((value) => value && String(value).trim()).join(" | ");
      if (issuerDetails) {
        drawValue(doc, issuerDetails, MARGIN + 14, issuerY + 24, CONTENT_WIDTH - 28, { bold: false, size: 6.9, height: 11, ellipsis: true });
      }

      const statusY = declarationY + 124;
      const status = cleanText(delivery.status, "PENDING").toUpperCase();
      const statusWidth = Math.max(62, Math.min(105, status.length * 5.4 + 24));
      const statusFill = status === "DELIVERED" ? "#E8F7EC" : status === "CANCELLED" ? "#FDECEC" : "#FFF6DF";
      const statusColor = status === "DELIVERED" ? "#16803A" : status === "CANCELLED" ? "#B42318" : "#A15C00";
      doc.roundedRect(MARGIN + 14, statusY, statusWidth, 18, 9).fill(statusFill);
      doc.font("Helvetica-Bold").fontSize(6.8).fillColor(statusColor).text(status, MARGIN + 14, statusY + 5.5, { width: statusWidth, align: "center" });
      drawValue(doc, `Delivery status | Booking date: ${formatDate(delivery.bookingDate, true)}`, MARGIN + 26 + statusWidth, statusY + 5, CONTENT_WIDTH - statusWidth - 40, { bold: false, size: 6.9, height: 10, ellipsis: true });

      drawFooter(doc, business, 1);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });

module.exports = generateInvoicePdf;
