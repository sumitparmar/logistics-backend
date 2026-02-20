const mongoose = require("mongoose");

const FailedJobSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    payload: { type: Object, required: true },
    error: { type: String },
    provider: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("FailedJob", FailedJobSchema);
