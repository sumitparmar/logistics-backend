const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth.middleware");

const { getDashboardSummary } = require("../controllers/dashboard.controller");

// SUMMARY
router.get("/summary", protect, getDashboardSummary);

module.exports = router;
