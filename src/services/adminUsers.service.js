const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const User = require("../models/User");

const createUser = async (data) => {
  const { name, email, role, adminRoleId, isActive } = data;

  // -------------------------
  // Validation
  // -------------------------

  if (!name || !email || !role) {
    throw new Error("Name, email and role are required.");
  }

  // -------------------------
  // Duplicate Email
  // -------------------------

  const existingEmail = await User.findOne({
    email: email.toLowerCase().trim(),
  });

  if (existingEmail) {
    throw new Error("User already exists with this email.");
  }

  // -------------------------
  // Temporary Password
  // -------------------------

  const tempPassword = crypto.randomBytes(8).toString("hex");

  const hashedPassword = await bcrypt.hash(tempPassword, 10);

  // -------------------------
  // Create User
  // -------------------------

  const user = await User.create({
    name: name.trim(),

    email: email.toLowerCase().trim(),

    password: hashedPassword,

    role,

    adminRole: role === "admin" ? adminRoleId || null : null,

    isActive,

    authProvider: "email",

    isEmailVerified: false,
  });

  return {
    user,
    temporaryPassword: tempPassword,
  };
};

module.exports = {
  createUser,
};
