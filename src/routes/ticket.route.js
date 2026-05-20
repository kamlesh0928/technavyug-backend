import express from "express";
import { body } from "express-validator";
import ticketController from "../controllers/ticket.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";

const router = express.Router();

router.use(authenticate);

// Customer routes
router.post(
  "/",
  body("subject").notEmpty().withMessage("Subject is required"),
  body("description").notEmpty().withMessage("Description is required"),
  validate,
  ticketController.createTicket,
);

router.get("/my", ticketController.getMyTickets);
router.get("/:id", ticketController.getTicketById);

router.post(
  "/:id/reply",
  body("message").notEmpty().withMessage("Message is required"),
  validate,
  ticketController.replyToTicket,
);

// Admin routes
router.get(
  "/",
  authorize("Super Admin", "Admin", "Sub Admin"),
  ticketController.listAllTickets,
);

router.patch(
  "/:id/status",
  authorize("Super Admin", "Admin", "Sub Admin"),
  ticketController.updateTicketStatus,
);

export default router;
