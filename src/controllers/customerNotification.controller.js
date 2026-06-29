const {
  getCustomerNotifications,
  markNotificationRead,
  getUnreadCount,
  markAllNotificationsRead,
  deleteNotification,
} = require("../services/customerNotification.service");

const getNotifications = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const filters = {};

    if (req.query.type) filters.type = req.query.type;
    if (req.query.priority) filters.priority = req.query.priority;
    if (req.query.search) filters.search = req.query.search;
    if (req.query.isRead !== undefined) {
      filters.isRead = req.query.isRead === "true" || req.query.isRead === true;
    }

    const result = await getCustomerNotifications(
      req.user._id,
      page,
      limit,
      filters,
    );

    return res.json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    await markAllNotificationsRead(req.user._id);

    return res.json({
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

const markRead = async (req, res, next) => {
  try {
    const notification = await markNotificationRead(
      req.params.id,
      req.user._id,
    );

    return res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

const removeNotification = async (req, res, next) => {
  try {
    const notification = await deleteNotification(req.params.id, req.user._id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

const unreadCount = async (req, res, next) => {
  try {
    const count = await getUnreadCount(req.user._id);

    return res.json({
      success: true,
      count,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markRead,
  unreadCount,
  markAllRead,
  removeNotification,
};
