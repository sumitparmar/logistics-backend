const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: String(process.env.EMAIL_SECURE).toLowerCase() === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized:
      String(process.env.EMAIL_TLS_REJECT_UNAUTHORIZED).toLowerCase() !==
      "false",
  },
});

const sendEmail = async (to, subject, html, attachments = [], text = null) => {
  return transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || "MoveKart Logistics"}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    ...(text ? { text } : {}),
    attachments,
  });
};

module.exports = sendEmail;
