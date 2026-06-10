const express = require("express");
const protect = require("../middlewares/auth.middleware");

const {
  getNotifications,
  markRead,
  unreadCount,
} = require("../controllers/customerNotification.controller");

const router = express.Router();

router.use(protect);

router.get("/", getNotifications);

router.get("/unread-count", unreadCount);

router.patch("/:id/read", markRead);

module.exports = router;
