const express = require("express");
const router = express.Router();
const {
  createSupportTicket,
} = require("../controllers/adminSupport.controller");

// ❗ NO AUTH HERE (public route)
router.post("/create", createSupportTicket);

module.exports = router;
