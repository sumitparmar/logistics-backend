const otpQueue = require("../queues/otp.queue");
const { sendSms } = require("../services/sms.service");
const sendEmail = require("../utils/sendEmail");

// Process up to 5 jobs in parallel
const CONCURRENCY = 5;

otpQueue.process(CONCURRENCY, async (job) => {
  const { phone, otp, email } = job.data;

  try {
    // Send SMS (required)
    await sendSms(phone, `Your OTP is ${otp}`);

    // Send Email (optional, non-blocking logic)
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
      } catch (emailError) {
        console.error(
          `[OTP WORKER] Email failed for ${phone}:`,
          emailError.message,
        );
        // Do not throw here — SMS already succeeded
      }
    }

    return true;
  } catch (error) {
    console.error(`[OTP WORKER] Job ${job.id} failed:`, error.message);

    // Throw to trigger Bull retry mechanism
    throw error;
  }
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
