const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth.middleware");
const { getVehicles } = require("../controllers/vehicles.controller");

router.get("/", protect, getVehicles);
module.exports = router;
