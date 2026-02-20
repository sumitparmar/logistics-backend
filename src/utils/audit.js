const AuditLog = require("../models/AuditLog");

const logAction = async ({ user, action, req, meta = {} }) => {
  try {
    await AuditLog.create({
      user,
      action,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      meta,
    });
  } catch (err) {
    console.log("AUDIT LOG ERROR:", err.message);
  }
};

module.exports = { logAction };
