const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth.middleware");
const { getVehicleTypes } = require("../controllers/vehicles.controller");

router.get("/", protect, getVehicleTypes);

module.exports = router;
