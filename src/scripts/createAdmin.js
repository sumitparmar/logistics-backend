require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const {
  MONGO_URI,
  ADMIN_NAME = "MoveKart Admin",
  ADMIN_EMAIL,
  ADMIN_PHONE,
  ADMIN_PASSWORD,
} = process.env;

(async () => {
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI is required");
    }

    if (!ADMIN_EMAIL && !ADMIN_PHONE) {
      throw new Error("ADMIN_EMAIL or ADMIN_PHONE is required");
    }

    if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 6) {
      throw new Error("ADMIN_PASSWORD must be at least 6 characters");
    }

    await mongoose.connect(MONGO_URI);

    const password = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const query = ADMIN_EMAIL ? { email: ADMIN_EMAIL } : { phone: ADMIN_PHONE };

    const admin = await User.findOneAndUpdate(
      query,
      {
        $set: {
          name: ADMIN_NAME,
          email: ADMIN_EMAIL,
          phone: ADMIN_PHONE,
          password,
          role: "admin",
          authProvider: ADMIN_EMAIL ? "email" : "otp",
          isEmailVerified: !!ADMIN_EMAIL,
          isPhoneVerified: !!ADMIN_PHONE,
          isActive: true,
          isDeleted: false,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
})();
