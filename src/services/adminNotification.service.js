const AdminNotification = require("../models/AdminNotification");

const createAdminNotification = async (payload) => {
  return await AdminNotification.create(payload);
};

const getAdminNotifications = async ({
  page = 1,
  limit = 20,
  type,
  isRead,
}) => {
  const query = {};

  if (type) query.type = type;
  if (isRead !== undefined) query.isRead = isRead;

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    AdminNotification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),

    AdminNotification.countDocuments(query),
  ]);

  return {
    data,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
    },
  };
};

const markAdminNotificationRead = async (id) => {
  return await AdminNotification.findByIdAndUpdate(
    id,
    { isRead: true },
    { new: true },
  );
};

module.exports = {
  createAdminNotification,
  getAdminNotifications,
  markAdminNotificationRead,
};
