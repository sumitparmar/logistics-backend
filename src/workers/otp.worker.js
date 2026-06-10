const otpQueue = require("../queues/otp.queue");
const { sendSmsSafely } = require("../services/sms.service");
const sendEmail = require("../utils/sendEmail");

// Process up to 5 jobs in parallel
const CONCURRENCY = 5;

otpQueue.process(CONCURRENCY, async (job) => {
  const { phone, otp, email } = job.data;

  const deliveryResults = [];

  const smsResult = await sendSmsSafely(phone, `Your OTP is ${otp}`, {
    jobId: job.id,
    channel: "otp",
  });
  deliveryResults.push(smsResult);

  if (email) {
    try {
      await sendEmail(
        email,
        "Your OTP - MoveKart",
        `
    <h2>MoveKart Login OTP</h2>
    <h3>${otp}</h3>
    <p>This OTP is valid for 5 minutes.</p>
  `,
      );
      deliveryResults.push({ email: true });
    } catch (emailError) {
      console.error(
        `[OTP WORKER] Email failed for ${phone}:`,
        emailError.message,
      );
      deliveryResults.push({ failed: true, error: emailError.message });
    }
  }

  if (deliveryResults.some((result) => !result?.failed)) {
    return true;
  }

  const error = new Error("OTP delivery failed on every available channel");
  console.error(`[OTP WORKER] Job ${job.id} failed:`, error.message);
  throw error;
});

// Queue lifecycle logging
otpQueue.on("completed", (job) => {});

otpQueue.on("failed", (job, err) => {
  console.error(
    `[OTP QUEUE] Job ${job.id} failed after ${job.attemptsMade} attempts`,
    err.message,
  );
});

otpQueue.on("error", (err) => {
  console.error("[OTP QUEUE] Redis/Bull error:", err.message);
});
