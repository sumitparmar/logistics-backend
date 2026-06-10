const CustomerNotification = require("../models/CustomerNotification");

const createCustomerNotification = async ({
  user,
  order,
  type,
  title,
  message,
}) => {
  return CustomerNotification.create({
    user,
    order,
    type,
    title,
    message,
  });
};

const getCustomerNotifications = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    CustomerNotification.find({
      user: userId,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("order", "_id borzoOrderId status"),

    CustomerNotification.countDocuments({
      user: userId,
    }),
  ]);

  return {
    data,
    total,
  };
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
};
