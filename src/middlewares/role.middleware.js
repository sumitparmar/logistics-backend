const AdminRole = require("../models/AdminRole");

// BACKWARD COMPAT (KEEP EXISTING)
const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }
    next();
  };
};

// NEW: PERMISSION BASED RBAC
const allowPermissions = (...requiredPermissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      // ✅ SUPER ADMIN (no adminRole → full access)
      if (req.user.role === "admin" && !req.user.adminRole) {
        return next();
      }

      // ❌ Not an admin
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Admin access required",
        });
      }

      // 🔎 Fetch role
      const role = await AdminRole.findById(req.user.adminRole);

      if (!role) {
        return res.status(403).json({
          success: false,
          message: "No role assigned",
        });
      }

      // ✅ Permission check
      const hasAccess = requiredPermissions.every((perm) =>
        role.permissions.includes(perm),
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "Permission denied",
        });
      }

      next();
    } catch (error) {
      console.error("RBAC ERROR:", error);
      return res.status(500).json({
        success: false,
        message: "Permission check failed",
      });
    }
  };
};

module.exports = {
  allowRoles,
  allowPermissions,
};
