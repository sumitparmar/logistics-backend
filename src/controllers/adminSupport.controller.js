const AdminSupportTicket = require("../models/AdminSupportTicket");
const mongoose = require("mongoose");
const User = require("../models/User");

// GET SUPPORT TICKETS
const getSupportTickets = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim();

    const query = {};

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      const userIds = users.map((u) => u._id);

      query.$or = [
        { subject: { $regex: search, $options: "i" } },
        ...(userIds.length ? [{ user: { $in: userIds } }] : []),
      ];
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

const allowedStatus = ["open", "in-progress", "resolved"];

const updateSupportTicketStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const ticket = await AdminSupportTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    //  LOCK: prevent changing resolved ticket directly
    if (ticket.status === "resolved" && status !== "in-progress") {
      return res.status(400).json({
        success: false,
        message: "Resolved ticket can only be reopened",
      });
    }

    ticket.status = status;
    await ticket.save();

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
    const { userId, subject, priority = "medium" } = req.body;

    //  REQUIRED FIELD CHECK
    if (!userId || !subject) {
      return res.status(400).json({
        success: false,
        message: "userId and subject are required",
      });
    }

    //  OBJECT ID VALIDATION
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId format",
      });
    }

    //  CHECK USER EXISTS (CRITICAL FIX)
    const userExists = await User.findById(userId);

    if (!userExists) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    //  CREATE TICKET
    const ticket = await AdminSupportTicket.create({
      user: userId,
      subject,
      priority,
      status: "open",
    });

    return res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("createSupportTicket FULL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create ticket",
    });
  }
};

const getSupportTicketCounts = async (req, res) => {
  try {
    const tickets = await AdminSupportTicket.find({}, "status");

    let counts = {
      open: 0,
      "in-progress": 0,
      resolved: 0,
    };

    tickets.forEach((t) => {
      if (t.status === "open") counts.open++;
      else if (t.status === "in-progress") counts["in-progress"]++;
      else if (t.status === "resolved") counts.resolved++;
    });

    res.json({
      success: true,
      data: counts,
    });
  } catch (err) {
    console.error("getSupportTicketCounts error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch ticket counts",
    });
  }
};

module.exports = {
  getSupportTickets,
  getSupportTicketById,
  replyToSupportTicket,
  updateSupportTicketStatus,
  createSupportTicket,
  getSupportTicketCounts,
};
