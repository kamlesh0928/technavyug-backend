import crypto from "crypto";
import { Op } from "sequelize";
import { Ticket, TicketReply, User } from "../models/index.js";
import { getPagination, getPaginatedResponse } from "../utils/pagination.js";
import Logger from "../utils/logger.js";

const generateTicketNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `TKT-${timestamp}-${random}`;
};

const createTicket = async (req, res) => {
  try {
    const { subject, description, priority } = req.body;

    const ticket = await Ticket.create({
      ticketNumber: generateTicketNumber(),
      userId: req.user.id,
      subject,
      description,
      priority: priority || "Medium",
    });

    Logger.info("Ticket created", { ticketId: ticket.id });
    res
      .status(201)
      .json({ message: "Ticket created successfully", data: ticket });
  } catch (error) {
    Logger.error("Error creating ticket", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getMyTickets = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status } = req.query;

    const where = { userId: req.user.id };
    if (status) where.status = status;

    const { count, rows } = await Ticket.findAndCountAll({
      where,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    Logger.error("Error fetching tickets", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id, {
      include: [
        { model: User, attributes: ["id", "name", "email", "avatar"] },
        {
          model: TicketReply,
          as: "replies",
          include: [
            { model: User, attributes: ["id", "name", "role", "avatar"] },
          ],
          order: [["createdAt", "ASC"]],
        },
      ],
    });

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Users can only view their own tickets (unless admin)
    if (
      ticket.userId !== req.user.id &&
      !["Super Admin", "Admin", "Sub Admin"].includes(req.user.role)
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.status(200).json({ data: ticket });
  } catch (error) {
    Logger.error("Error fetching ticket", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const replyToTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Users can reply to their own tickets; admins can reply to any
    if (
      ticket.userId !== req.user.id &&
      !["Super Admin", "Admin", "Sub Admin"].includes(req.user.role)
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (ticket.status === "Closed") {
      return res
        .status(400)
        .json({ message: "Cannot reply to a closed ticket" });
    }

    const reply = await TicketReply.create({
      ticketId: ticket.id,
      userId: req.user.id,
      message: req.body.message,
    });

    // Auto-update ticket status
    if (
      ["Super Admin", "Admin", "Sub Admin"].includes(req.user.role) &&
      ticket.status === "Open"
    ) {
      ticket.status = "InProgress";
      ticket.assignedTo = req.user.id;
      await ticket.save();
    }

    const fullReply = await TicketReply.findByPk(reply.id, {
      include: [{ model: User, attributes: ["id", "name", "role", "avatar"] }],
    });

    Logger.info("Ticket reply added", {
      ticketId: ticket.id,
      replyId: reply.id,
    });
    res
      .status(201)
      .json({ message: "Reply added successfully", data: fullReply });
  } catch (error) {
    Logger.error("Error replying to ticket", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateTicketStatus = async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const { status, priority, assignedTo } = req.body;

    if (status) {
      const validStatuses = ["Open", "InProgress", "Resolved", "Closed"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid ticket status" });
      }
      ticket.status = status;
    }

    if (priority) {
      const validPriorities = ["Low", "Medium", "High", "Urgent"];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({ message: "Invalid priority level" });
      }
      ticket.priority = priority;
    }

    if (assignedTo !== undefined) ticket.assignedTo = assignedTo;

    await ticket.save();

    Logger.info("Ticket status updated", { ticketId: ticket.id });
    res
      .status(200)
      .json({ message: "Ticket updated successfully", data: ticket });
  } catch (error) {
    Logger.error("Error updating ticket", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Admin: list all tickets
const listAllTickets = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, priority, search } = req.query;

    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (search) {
      where[Op.or] = [
        { subject: { [Op.like]: `%${search}%` } },
        { ticketNumber: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Ticket.findAndCountAll({
      where,
      include: [{ model: User, attributes: ["id", "name", "email"] }],
      limit,
      offset,
      order: [
        ["priority", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    res.status(200).json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    Logger.error("Error listing tickets", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export default {
  createTicket,
  getMyTickets,
  getTicketById,
  replyToTicket,
  updateTicketStatus,
  listAllTickets,
};
