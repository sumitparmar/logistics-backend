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
  } catch (err) {}
};

module.exports = { logAction };
