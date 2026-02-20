const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const { getMismatches } = require("../controllers/reconciliation.controller");

router.get("/mismatches", protect, allowRoles("Admin"), getMismatches);

module.exports = router;
