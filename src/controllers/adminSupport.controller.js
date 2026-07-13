const AdminSupportTicket = require("../models/AdminSupportTicket");
const mongoose = require("mongoose");
const User = require("../models/User");
const { getIO } = require("../config/socket");
const AdminNotification = require("../models/AdminNotification");
// GET SUPPORT TICKETS

const escapeRegex = (text) => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const getSupportTickets = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim();

    const query = {};

    if (req.user.role !== "admin") {
      query.user = req.user._id;
    }

    if (req.query.status) {
      const statuses = Array.isArray(req.query.status)
        ? req.query.status
        : String(req.query.status)
            .split(",")
            .map((status) => status.trim())
            .filter(Boolean);

      query.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }

    if (search && search.trim().length >= 2) {
      const safeSearch = escapeRegex(search);

      const users = await User.find({
        $or: [
          { name: { $regex: safeSearch, $options: "i" } },
          { email: { $regex: safeSearch, $options: "i" } },
        ],
      })
        .select("_id")
        .limit(50);

      const userIds = users.map((u) => u._id);

      const orConditions = [
        { subject: { $regex: safeSearch, $options: "i" } },
        { name: { $regex: safeSearch, $options: "i" } },
        { email: { $regex: safeSearch, $options: "i" } },
      ];

      if (userIds.length) {
        orConditions.push({ user: { $in: userIds } });
      }

      query.$or = orConditions;
    }
    const [tickets, total] = await Promise.all([
      AdminSupportTicket.find(query)
        .populate("user", "name email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      AdminSupportTicket.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: tickets,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getSupportTickets error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch support tickets",
    });
  }
};

const AdminSupportMessage = require("../models/AdminSupportMessage");

// GET SINGLE TICKET
const canAccessTicket = (req, ticket) => {
  if (req.user?.role === "admin") return true;
  return (
    ticket.user &&
    String(ticket.user._id || ticket.user) === String(req.user?._id)
  );
};

const getSupportTicketById = async (req, res) => {
  try {
    const ticket = await AdminSupportTicket.findById(req.params.id)
      .populate({
        path: "user",
        select: "name email phone",
      })
      .lean();

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (req.user && !canAccessTicket(req, ticket)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this ticket",
      });
    }

    if (ticket.user && typeof ticket.user === "string") {
      const user = await User.findById(ticket.user).select("name email phone");
      ticket.user = user;
    }

    const messages = await AdminSupportMessage.find({
      ticket: ticket._id,
    })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      success: true,
      data: {
        ...ticket,
        messages,
      },
    });
  } catch (error) {
    console.error("getSupportTicketById error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch ticket",
    });
  }
};

const replyToSupportTicket = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID",
      });
    }

    //  ADD THIS BLOCK BEFORE CREATE
    const ticketExists = await AdminSupportTicket.findById(req.params.id);

    if (!ticketExists) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    //  THEN CREATE
    const newMessage = await AdminSupportMessage.create({
      ticket: req.params.id,
      sender: "admin",
      message,
    });

    ticketExists.unreadForUser += 1;
    ticketExists.unreadForAdmin = 0;

    ticketExists.lastMessageAt = new Date();
    ticketExists.lastRepliedBy = "admin";

    await ticketExists.save();

    const io = getIO();

    // get full updated ticket with messages
    const updatedTicket = await AdminSupportTicket.findById(req.params.id)
      .populate("user", "name email phone")
      .lean();

    const messages = await AdminSupportMessage.find({
      ticket: req.params.id,
    })
      .sort({ createdAt: 1 })
      .lean();

    // send to USER
    if (updatedTicket.user?._id) {
      io.to(`user:${updatedTicket.user._id}`).emit("ticket_reply", {
        ...updatedTicket,
        messages,
      });
    }

    // update ADMIN panels also
    io.to("admin").emit("ticket_updated", {
      ...updatedTicket,
      messages,
    });

    return res.json({
      success: true,
      data: newMessage,
    });
  } catch (error) {
    console.error("replyToSupportTicket error:", error);
    return res.status(500).json({
      success: false,
      message: "Reply failed",
    });
  }
};

const replyToSupportTicketAsUser = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID",
      });
    }

    const ticket = await AdminSupportTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (!canAccessTicket(req, ticket)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this ticket",
      });
    }

    if (["RESOLVED", "CLOSED"].includes(ticket.status)) {
      ticket.status = "REOPENED";
    }

    const newMessage = await AdminSupportMessage.create({
      ticket: ticket._id,
      sender: "user",
      message: message.trim(),
      readByUser: true,
    });

    ticket.unreadForAdmin += 1;
    ticket.unreadForUser = 0;
    ticket.lastMessageAt = new Date();
    ticket.lastRepliedBy = "user";
    await ticket.save();

    const updatedTicket = await AdminSupportTicket.findById(ticket._id)
      .populate("user", "name email phone")
      .lean();

    const messages = await AdminSupportMessage.find({ ticket: ticket._id })
      .sort({ createdAt: 1 })
      .lean();

    const io = getIO();
    io.to("admin").emit("ticket_updated", {
      ...updatedTicket,
      messages,
    });

    return res.json({
      success: true,
      data: newMessage,
    });
  } catch (error) {
    console.error("replyToSupportTicketAsUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Reply failed",
    });
  }
};

const allowedStatus = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_CUSTOMER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
];
const updateSupportTicketStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket status",
      });
    }

    const ticket = await AdminSupportTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    //  LOCK: prevent changing resolved ticket directly
    if (ticket.status === "RESOLVED" && status !== "REOPENED") {
      return res.status(400).json({
        success: false,
        message: "Resolved ticket can only be reopened",
      });
    }

    ticket.status = status;
    if (status === "RESOLVED") ticket.resolvedAt = new Date();
    if (status === "CLOSED") ticket.closedAt = new Date();
    await ticket.save();

    const io = getIO();

    const updatedTicket = await AdminSupportTicket.findById(req.params.id)
      .populate("user", "name email phone")
      .lean();

    const messages = await AdminSupportMessage.find({
      ticket: req.params.id,
    })
      .sort({ createdAt: 1 })
      .lean();

    io.to("admin").emit("ticket_updated", {
      ...updatedTicket,
      messages,
    });

    if (updatedTicket.user?._id) {
      io.to(`user:${updatedTicket.user._id}`).emit("ticket_updated", {
        ...updatedTicket,
        messages,
      });
    }

    return res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("updateSupportTicketStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Status update failed",
    });
  }
};

const createSupportTicket = async (req, res) => {
  try {
    const { subject, priority = "medium" } = req.body;
    const userId = req.user?._id || req.body.userId;

    //  REQUIRED FIELD CHECK
    if (!subject || !req.body.message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject and message are required",
      });
    }

    let userExists = null;

    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid userId format",
        });
      }

      userExists = await User.findById(userId);

      if (!userExists) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
    }

    //  CREATE TICKET
    const { name, email, phone } = req.body;

    const ticket = await AdminSupportTicket.create({
      user: userId || null,
      name: userExists?.name || name,
      email: userExists?.email || email,
      phone: userExists?.phone || phone,
      order: mongoose.Types.ObjectId.isValid(req.body.order)
        ? req.body.order
        : null,
      subject,
      category: req.body.category || "OTHER",
      priority,
      status: "OPEN",
      unreadForAdmin: 1,
      unreadForUser: 0,
      lastMessageAt: new Date(),
      lastRepliedBy: "user",
    });

    ticket.ticketNumber = `MKT-TKT-${String(ticket._id)
      .slice(-6)
      .toUpperCase()}`;

    await ticket.save();

    await AdminNotification.create({
      type: "SYSTEM",
      title: "New Support Ticket",
      message: subject,
      isRead: false,
      priority: "HIGH",
      ticketId: ticket._id,
    });

    await AdminSupportMessage.create({
      ticket: ticket._id,
      sender: "user",
      message: req.body.message.trim(),
      readByUser: true,
    });

    const populatedTicket = await AdminSupportTicket.findById(ticket._id)
      .populate("user", "name email phone")
      .lean();

    const io = getIO();
    io.to("admin").emit("new_ticket", populatedTicket);

    return res.json({
      success: true,
      data: populatedTicket,
    });
  } catch (error) {
    console.error("createSupportTicket FULL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create ticket",
    });
  }
};

const markSupportTicketReadForUser = async (req, res) => {
  try {
    const ticket = await AdminSupportTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (!canAccessTicket(req, ticket)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this ticket",
      });
    }

    ticket.unreadForUser = 0;
    await ticket.save();

    await AdminSupportMessage.updateMany(
      { ticket: ticket._id, sender: "admin" },
      { $set: { readByUser: true } },
    );

    return res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("markSupportTicketReadForUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark ticket as read",
    });
  }
};

const getSupportTicketCounts = async (req, res) => {
  try {
    const counts = await AdminSupportTicket.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const formatted = {
      OPEN: 0,
      IN_PROGRESS: 0,
      WAITING_CUSTOMER: 0,
      RESOLVED: 0,
      CLOSED: 0,
      REOPENED: 0,
    };

    counts.forEach((c) => {
      formatted[c._id] = c.count;
    });

    return res.json({
      success: true,
      data: formatted,
    });
  } catch (err) {
    console.error("getSupportTicketCounts error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch ticket counts",
    });
  }
};

module.exports = {
  getSupportTickets,
  getSupportTicketById,
  replyToSupportTicket,
  replyToSupportTicketAsUser,
  updateSupportTicketStatus,
  createSupportTicket,
  markSupportTicketReadForUser,
  getSupportTicketCounts,
};
