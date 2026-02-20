const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    action: {
      type: String,
      required: true,
    },

    ip: String,

    userAgent: String,

    meta: Object,
  },
  { timestamps: true },
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
