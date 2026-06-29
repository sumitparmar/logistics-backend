const {
  createAdminNotification,
  getAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  deleteAdminNotification,
  getAdminUnreadCount,
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

const markAllAdminNotificationsAsRead = async (req, res) => {
  try {
    const data = await markAllAdminNotificationsRead();

    res.json({
      success: true,
      message: "All notifications marked as read",
      data,
    });
  } catch (error) {
    console.error("Error marking all notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update notifications",
    });
  }
};

const deleteAdminNotificationById = async (req, res) => {
  try {
    const data = await deleteAdminNotification(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification deleted",
      data,
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete notification",
    });
  }
};

const fetchAdminUnreadCount = async (req, res) => {
  try {
    const count = await getAdminUnreadCount();
    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch unread count",
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
  markAllAdminNotificationsAsRead,
  deleteAdminNotificationById,
  fetchAdminUnreadCount,
  createTestNotification,
};
