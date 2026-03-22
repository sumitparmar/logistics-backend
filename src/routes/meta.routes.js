const express = require("express");
const router = express.Router();
const config = require("../config/deliveryTypes.config");

router.get("/delivery-types", (req, res) => {
  res.json({
    success: true,
    data: config,
  });
});

module.exports = router;
