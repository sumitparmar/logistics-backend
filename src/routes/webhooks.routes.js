const express = require("express");
const router = express.Router();
const {
  borzoWebhook,
  borzoDeliveryWebhook,
} = require("../controllers/webhooks.controller");

router.post("/borzo", borzoWebhook);
router.post("/borzo/delivery", borzoDeliveryWebhook);

module.exports = router;
