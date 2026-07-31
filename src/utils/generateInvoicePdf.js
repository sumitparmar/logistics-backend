const PDFDocument = require("pdfkit");
const vehicleTypes = require("../constants/vehicleTypes");

const formatCurrency = (amount = 0) => `₹ ${Number(amount).toFixed(2)}`;

const generateInvoicePdf = (invoice, order, user) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
      });

      const buffers = [];

      doc.on("data", buffers.push.bind(buffers));

      doc.on("end", () => {
        resolve(Buffer.concat(buffers));
      });

      // ====================================================
      // COLORS
      // ====================================================

      const primary = "#111827";
      const secondary = "#6B7280";
      const border = "#E5E7EB";
      const bg = "#F9FAFB";

      let y = 40;

      // ====================================================
      // HEADER
      // ====================================================

      doc
        .font("Helvetica-Bold")
        .fontSize(24)
        .fillColor(primary)
        .text("MoveKart", 40, y);

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(secondary)
        .text("Moving & Delivery Solutions", 40, y + 28);

      y += 60;

      doc.moveTo(40, y).lineTo(555, y).stroke(border);

      y += 20;

      // ====================================================
      // PAYMENT SUMMARY
      // ====================================================

      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor(primary)
        .text("Payment Summary", 40, y);

      y += 30;

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(secondary)
        .text("Invoice ID", 40, y);

      doc.fillColor(primary).text(invoice.invoiceNumber, 420, y, {
        width: 120,
        align: "right",
      });

      y += 20;

      doc.fillColor(secondary).text("Order ID", 40, y);

      doc.fillColor(primary).text(order._id.toString(), 320, y, {
        width: 220,
        align: "right",
      });

      y += 20;

      doc.fillColor(secondary).text("Date", 40, y);

      doc
        .fillColor(primary)
        .text(new Date(invoice.createdAt).toLocaleString(), 320, y, {
          width: 220,
          align: "right",
        });

      y += 35;

      // ====================================================
      // TOTAL CARD
      // ====================================================

      doc.roundedRect(40, y, 515, 90, 10).fill(bg);

      doc
        .font("Helvetica")
        .fontSize(14)
        .fillColor(secondary)
        .text("TOTAL", 40, y + 20, {
          width: 515,
          align: "center",
        });

      doc
        .font("Helvetica-Bold")
        .fontSize(30)
        .fillColor(primary)
        .text(formatCurrency(invoice.total), 40, y + 40, {
          width: 515,
          align: "center",
        });

      y += 120;

      // ====================================================
      // PICKUP
      // ====================================================

      doc.roundedRect(40, y, 515, 70, 8).stroke(border);

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#10B981")
        .text("PICKUP", 55, y + 12);

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(primary)
        .text(order?.pickup?.address || "-", 55, y + 30, {
          width: 470,
        });

      y += 85;

      // ====================================================
      // DELIVERY
      // ====================================================

      doc.roundedRect(40, y, 515, 70, 8).stroke(border);

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#EF4444")
        .text("DELIVERY", 55, y + 12);

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(primary)
        .text(order?.drop?.address || "-", 55, y + 30, {
          width: 470,
        });

      y += 95;

      // ====================================================
      // ORDER INFO
      // ====================================================

      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(primary)
        .text("Order Details", 40, y);

      y += 25;

      const vehicleId =
        order?.vehicle?.type ||
        order?.rawProviderResponse?.order?.vehicle_type_id ||
        order?.rawProviderResponse?.orders?.[0]?.vehicle_type_id ||
        "-";

      const vehicleName =
        vehicleTypes.find((v) => String(v.id) === String(vehicleId))?.name ||
        `Vehicle ${vehicleId}`;

      const details = [
        ["Status", order.status || "-"],
        ["Vehicle", vehicleName],
        ["Weight", `${order?.package?.weight || 0} KG`],
        ["Payment", order?.payment?.method || "-"],
      ];

      details.forEach(([label, value]) => {
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor(secondary)
          .text(label, 40, y);

        doc.font("Helvetica-Bold").fillColor(primary).text(value, 350, y, {
          width: 180,
          align: "right",
        });

        y += 20;
      });

      y += 15;

      // ====================================================
      // BILL DETAILS
      // ====================================================

      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(primary)
        .text("Bill Details", 40, y);

      y += 30;

      invoice.lineItems.forEach((item) => {
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor(primary)
          .text(item.label, 40, y);

        doc.text(formatCurrency(item.amount), 420, y, {
          width: 120,
          align: "right",
        });

        y += 20;
      });

      doc.moveTo(40, y).lineTo(555, y).stroke(border);

      y += 15;

      doc.font("Helvetica-Bold").fontSize(13).text("TOTAL", 40, y);

      doc.text(formatCurrency(invoice.total), 420, y, {
        width: 120,
        align: "right",
      });

      y += 60;

      // ====================================================
      // FOOTER
      // ====================================================

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(secondary)
        .text("Thank you for choosing MoveKart Logistics", 40, y, {
          width: 515,
          align: "center",
        });

      y += 20;

      doc
        .fontSize(8)
        .text(
          "This is a computer generated invoice and does not require a signature.",
          40,
          y,
          {
            width: 515,
            align: "center",
          },
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = generateInvoicePdf;
