const express = require("express");
const router = express.Router();

const {
  createSupportTicket,
  getSupportTickets,
  getSupportTicketById,
  replyToSupportTicketAsUser,
  markSupportTicketReadForUser,
} = require("../controllers/adminSupport.controller");

const protect = require("../middlewares/auth.middleware");

// Backward-compatible public alias for existing contact/support form submissions.
router.post("/create", createSupportTicket);

router.use(protect);

router.get("/tickets", getSupportTickets);
router.get("/tickets/:id", getSupportTicketById);
router.post("/tickets", createSupportTicket);
router.post("/tickets/:id/reply", replyToSupportTicketAsUser);
router.patch("/tickets/:id/read", markSupportTicketReadForUser);

module.exports = router;
