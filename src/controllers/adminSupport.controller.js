const AdminSupportTicket = require("../models/AdminSupportTicket");

// GET SUPPORT TICKETS
const getSupportTickets = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      AdminSupportTicket.find()
        .populate("user", "name email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      AdminSupportTicket.countDocuments(),
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
      .populate("user", "name email phone")
      .lean();

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
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

const updateSupportTicketStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const ticket = await AdminSupportTicket.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );

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

module.exports = {
  getSupportTickets,
  getSupportTicketById,
  replyToSupportTicket,
  updateSupportTicketStatus,
};
