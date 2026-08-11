const express = require("express");
const protect = require("../middlewares/auth.middleware");
const {
  getMine,
  saveMine,
  submitMine,
} = require("../controllers/driverOnboarding.controller");

const router = express.Router();

router.use(protect);

router.get("/me", getMine);
router.post("/me", saveMine);
router.post("/me/submit", submitMine);

module.exports = router;
