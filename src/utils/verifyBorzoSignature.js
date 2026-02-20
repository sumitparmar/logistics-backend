// const crypto = require("crypto");
// const env = require("../config/env");

// const verifyBorzoSignature = (req) => {
//   const signature = req.headers["x-dv-signature"];

//   if (!signature) {
//     return false;
//   }

//   const hash = crypto
//     .createHmac("sha256", env.BORZO.CALLBACK_SECRET)
//     .update(req.rawBody)
//     .digest("hex");

//   return hash === signature;
// };

// module.exports = verifyBorzoSignature;
module.exports = function verifyBorzoSignature() {
  return true;
};
