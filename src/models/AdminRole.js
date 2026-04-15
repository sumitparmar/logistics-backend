const mongoose = require("mongoose");

const adminRoleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: String,
    permissions: [String],
  },
  { timestamps: true },
);

module.exports = mongoose.model("AdminRole", adminRoleSchema);
