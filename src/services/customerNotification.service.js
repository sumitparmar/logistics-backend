const CustomerNotification = require("../models/CustomerNotification");
const { getIO } = require("../config/socket");

const createCustomerNotification = async ({
  user,
  order,
  ticketId,
  type,
  title,
  message,
  priority = "MEDIUM",
  actionLabel,
  actionUrl,
  meta = {},
}) => {
  const notification = await CustomerNotification.create({
    user,
    order,
    ticketId,
    type,
    title,
    message,
    priority,
    actionLabel,
    actionUrl,
    meta,
  });

  try {
    const populated = await notification.populate(
      "order",
      "_id borzoOrderId status",
    );
    getIO().to(`user:${user}`).emit("customer_notification", populated);
  } catch (error) {
    console.error("customer notification socket emit failed:", error.message);
  }

  return notification;
};

const getCustomerNotifications = async (
  userId,
  page = 1,
  limit = 20,
  filters = {},
) => {
  const skip = (page - 1) * limit;
  const query = { user: userId };

  if (filters.type) query.type = filters.type;
  if (filters.isRead !== undefined) query.isRead = filters.isRead;
  if (filters.priority) query.priority = filters.priority;

  if (filters.search && filters.search.trim().length >= 2) {
    const safeSearch = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { title: { $regex: safeSearch, $options: "i" } },
      { message: { $regex: safeSearch, $options: "i" } },
      { type: { $regex: safeSearch, $options: "i" } },
    ];
  }

  const [data, total] = await Promise.all([
    CustomerNotification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("order", "_id borzoOrderId status"),

    CustomerNotification.countDocuments(query),
  ]);

  return {
    data,
    total,
  };
};

const deleteNotification = async (id, userId) => {
  return CustomerNotification.findOneAndDelete({
    _id: id,
    user: userId,
  });
};

const markNotificationRead = async (id, userId) => {
  return CustomerNotification.findOneAndUpdate(
    {
      _id: id,
      user: userId,
    },
    {
      isRead: true,
    },
    {
      new: true,
    },
  );
};

const markAllNotificationsRead = async (userId) => {
  return CustomerNotification.updateMany(
    {
      user: userId,
      isRead: false,
    },
    {
      isRead: true,
    },
  );
};

const getUnreadCount = async (userId) => {
  return CustomerNotification.countDocuments({
    user: userId,
    isRead: false,
  });
};

module.exports = {
  createCustomerNotification,
  getCustomerNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
  deleteNotification,
};
