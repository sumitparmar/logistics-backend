const express = require("express");
const router = express.Router();

const { getVehicles } = require("../controllers/providerCatalog.controller");

router.get("/vehicles", getVehicles);

module.exports = router;
