const express = require("express");
const protect = require("../middlewares/auth.middleware");
const { publicApplicationLimiter } = require("../middlewares/rateLimiter");
const {
  getOptions,
  getPublicOptions,
  submitPublic,
  getMine,
  saveMine,
  submitMine,
} = require("../controllers/driverOnboarding.controller");

const router = express.Router();

router.get("/public/options", getPublicOptions);
router.post("/public/submit", publicApplicationLimiter, submitPublic);

router.use(protect);

router.get("/options", getOptions);
router.get("/me", getMine);
router.post("/me", saveMine);
router.post("/me/submit", submitMine);

module.exports = router;
