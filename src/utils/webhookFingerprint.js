const crypto = require("crypto");

module.exports = function webhookFingerprint(payload) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
};
