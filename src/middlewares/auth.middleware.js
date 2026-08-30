const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticate = async (req, res, next, required) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    if (!required) return next();
    return res.status(401).json({
      success: false,
      message: "Not authorized",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password").populate({
      path: "adminRole",
      select: "permissions name",
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Account disabled",
      });
    }

    req.user = {
      _id: user._id,
      role: user.role,
      email: user.email,
      isActive: user.isActive,

      adminRole: user.adminRole || null,
      permissions: user.adminRole?.permissions || [],
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token invalid",
    });
  }
};

const protect = (req, res, next) => authenticate(req, res, next, true);
const optionalProtect = (req, res, next) => authenticate(req, res, next, false);

module.exports = protect;
module.exports.optionalProtect = optionalProtect;
