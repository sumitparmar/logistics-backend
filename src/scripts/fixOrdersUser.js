require("dotenv").config();
const mongoose = require("mongoose");
const Order = require("../models/Order");

const SYSTEM_USER_ID = "69956c36c343049730f6ef45";

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const result = await Order.updateMany(
      { user: { $exists: false } },
      { $set: { user: SYSTEM_USER_ID } },
    );

    console.log("Orders updated:", result.modifiedCount);

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
