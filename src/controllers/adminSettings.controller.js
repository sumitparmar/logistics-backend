const SystemSettings = require("../models/SystemSettings");
const AuditLog = require("../models/AuditLog");
const getOrCreateSettings = async () => {
  let settings = await SystemSettings.findOne();

  if (!settings) {
    settings = await SystemSettings.create({});
  }

  return settings;
};

const getSettings = async (req, res) => {
  try {
    await getOrCreateSettings();

    const settings = await SystemSettings.findOne().populate(
      "updatedBy",
      "name email",
    );

    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load settings",
    });
  }
};

const getSettingsAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find({
      action: "SETTINGS_UPDATED",
    })
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(5);

    return res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load audit logs",
    });
  }
};

const updateSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();

    const allowedFields = [
      "platformName",
      "supportEmail",
      "supportPhone",
      "timezone",
      "currency",
      "maintenanceMode",
      "allowRegistrations",
      "newOrderAlerts",
      "supportAlerts",
      "sessionTimeoutMinutes",
    ];

    const changes = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        const oldValue = settings[field];
        const newValue = req.body[field];

        if (String(oldValue) !== String(newValue)) {
          changes[field] = {
            oldValue,
            newValue,
          };

          settings[field] = newValue;
        }
      }
    });

    settings.updatedBy = req.user?._id || null;

    await settings.save();

    if (Object.keys(changes).length > 0) {
      await AuditLog.create({
        user: req.user?._id || null,
        action: "SETTINGS_UPDATED",
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        meta: {
          module: "settings",
          changes,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      data: settings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update settings",
    });
  }
};

const getPublicSettingsStatus = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();

    return res.status(200).json({
      success: true,
      data: {
        platformName: settings.platformName || "MoveKart",
        maintenanceMode: !!settings.maintenanceMode,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load public settings",
    });
  }
};

module.exports = {
  getSettings,
  getSettingsAuditLogs,
  updateSettings,
  getPublicSettingsStatus,
};
