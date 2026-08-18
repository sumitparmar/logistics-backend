const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const mongoose = require("mongoose");

const User = require("../models/User");
const AdminRole = require("../models/AdminRole");

const createUser = async (data) => {
  const { name, email, role, adminRoleId, isActive } = data;

  // -------------------------
  // Validation
  // -------------------------

  if (!name || !email || !role) {
    throw new Error("Name, email and role are required.");
  }

  if (!['user', 'admin', 'business'].includes(role)) {
    throw new Error("Invalid user role.");
  }

  if (typeof name !== 'string' || name.trim().length < 2) {
    throw new Error("Name must be at least 2 characters.");
  }

  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    throw new Error("A valid email is required.");
  }

  if (role === "admin" && adminRoleId) {
    if (!mongoose.isValidObjectId(adminRoleId)) {
      throw new Error("Invalid admin role.");
    }

    const adminRole = await AdminRole.exists({ _id: adminRoleId });
    if (!adminRole) {
      throw new Error("Admin role not found.");
    }
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
