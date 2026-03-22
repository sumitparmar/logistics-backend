const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

const sendEmail = async (to, subject, html) => {
  try {
    console.log("📧 Sending email to:", to);
    console.log("SMTP USER:", process.env.EMAIL_USER);

    const info = await transporter.sendMail({
      from: `"MoveKart Logistics" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent:", info.messageId);
  } catch (err) {
    console.error("❌ Email failed FULL:", err);
    // DO NOT throw error
  }
};

module.exports = sendEmail;
