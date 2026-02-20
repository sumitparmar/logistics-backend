import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";

await mongoose.connect("mongodb://127.0.0.1:27017/logistics_db");

const hash = await bcrypt.hash("admin123", 10);

await User.create({
  email: "admin@test.com",
  password: hash,
  role: "ADMIN",
});

process.exit();
