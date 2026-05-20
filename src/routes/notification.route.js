import express from "express";
import { body } from "express-validator";
import notificationController from "../controllers/notification.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";

const router = express.Router();

router.use(authenticate);

// User routes
router.get("/", notificationController.getMyNotifications);
router.get("/unread-count", notificationController.getUnreadCount);
router.patch("/:id/read", notificationController.markAsRead);
router.patch("/read-all", notificationController.markAllAsRead);
router.delete("/:id", notificationController.deleteNotification);

// Admin: send notification
router.post(
  "/send",
  authorize("Super Admin", "Admin", "Sub Admin"),
  body("title").notEmpty().withMessage("Title is required"),
  body("message").notEmpty().withMessage("Message is required"),
  validate,
  notificationController.sendNotification,
);

export default router;
