const express = require("express");
const protect = require("../middlewares/auth.middleware");

const {
  getNotifications,
  markRead,
  unreadCount,
  markAllRead,
  removeNotification,
} = require("../controllers/customerNotification.controller");

const router = express.Router();

router.use(protect);

router.get("/", getNotifications);

router.get("/unread-count", unreadCount);

router.patch("/read-all", markAllRead);

router.patch("/:id/read", markRead);

router.delete("/:id", removeNotification);

module.exports = router;
