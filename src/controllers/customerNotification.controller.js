const {
  getCustomerNotifications,
  markNotificationRead,
  getUnreadCount,
  markAllNotificationsRead,
} = require("../services/customerNotification.service");

const getNotifications = async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);

    const result = await getCustomerNotifications(req.user._id, page, limit);

    return res.json({
      success: true,
      data: result.data,
      total: result.total,
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
};
