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

      if (req.user.role === "admin" && !req.user.adminRole) {
        return next();
      }

      //  Not an admin
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Admin access required",
        });
      }

      //  USE PERMISSIONS FROM req.user (NO DB CALL)
      const userPermissions = req.user.permissions || [];

      const hasAccess = requiredPermissions.every((perm) =>
        userPermissions.includes(perm),
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

// Use this when a capability has a dedicated permission but must remain
// compatible with an older role that already owns the parent module access.
const allowAnyPermissions = (...requiredPermissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Admin access required",
        });
      }

      if (!req.user.adminRole) return next();

      const userPermissions = req.user.permissions || [];
      const hasAccess = requiredPermissions.some((perm) =>
        userPermissions.includes(perm),
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
  allowAnyPermissions,
};
