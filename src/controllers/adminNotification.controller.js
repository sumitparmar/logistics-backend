const {
  createAdminNotification,
  getAdminNotifications,
  markAdminNotificationRead,
} = require("../services/adminNotification.service");

const { getIO } = require("../config/socket");

const fetchAdminNotifications = async (req, res) => {
  try {
    const result = await getAdminNotifications(req.query);

    res.json({
      success: true,
      message: "Admin notifications fetched",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

const markAdminNotificationAsRead = async (req, res) => {
  try {
    const data = await markAdminNotificationRead(req.params.id);

    res.json({
      success: true,
      message: "Notification marked as read",
      data,
    });
  } catch (error) {
    console.error("Error marking notification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update notification",
    });
  }
};

const createTestNotification = async (req, res) => {
  try {
    const notification = await createAdminNotification({
      type: "SYSTEM",
      title: "Test Notification",
      message: "This is a test notification from backend",
      priority: "HIGH",
    });

    const io = getIO();
    io.to("admin").emit("admin_notification", notification);

    res.json({
      success: true,
      message: "Test notification created",
      data: notification,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to create test notification",
    });
  }
};

module.exports = {
  fetchAdminNotifications,
  markAdminNotificationAsRead,
  createTestNotification,
};
