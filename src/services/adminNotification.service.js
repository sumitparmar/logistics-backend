const AdminNotification = require("../models/AdminNotification");

const createAdminNotification = async (payload) => {
  return await AdminNotification.create(payload);
};

const getAdminNotifications = async ({
  page = 1,
  limit = 20,
  type,
  isRead,
  priority,
  search,
}) => {
  const query = {};

  if (type) query.type = type;
  if (isRead !== undefined) query.isRead = isRead === "true" || isRead === true;
  if (priority) query.priority = priority;
  if (search && search.trim().length >= 2) {
    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { title: { $regex: safeSearch, $options: "i" } },
      { message: { $regex: safeSearch, $options: "i" } },
      { type: { $regex: safeSearch, $options: "i" } },
    ];
  }

  page = Math.max(Number(page) || 1, 1);
  limit = Math.min(Math.max(Number(limit) || 20, 1), 100);
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

const markAllAdminNotificationsRead = async () => {
  return AdminNotification.updateMany({ isRead: false }, { isRead: true });
};

const deleteAdminNotification = async (id) => {
  return AdminNotification.findByIdAndDelete(id);
};

const getAdminUnreadCount = async () => {
  return AdminNotification.countDocuments({ isRead: false });
};

module.exports = {
  createAdminNotification,
  getAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  deleteAdminNotification,
  getAdminUnreadCount,
};
