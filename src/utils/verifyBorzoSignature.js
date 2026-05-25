const crypto = require("crypto");
const env = require("../config/env");

module.exports = function verifyBorzoSignature(req) {
  const signature = req.get("X-DV-Signature");
  const secret = env.BORZO.CALLBACK_SECRET;
  const body = req.rawBody;

  if (!signature || !secret || !body) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("hex");

  const receivedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
};
