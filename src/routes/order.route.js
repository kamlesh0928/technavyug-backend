import express from "express";
import { body } from "express-validator";
import orderController from "../controllers/order.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";

const router = express.Router();

router.use(authenticate);

// Customer routes
router.post(
  "/",
  body("items")
    .isArray({ min: 1 })
    .withMessage("Order must contain at least one item"),
  body("items.*.productId").notEmpty().withMessage("Product ID is required"),
  body("items.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),
  validate,
  orderController.createOrder,
);

router.get("/my", orderController.getMyOrders);

// Admin routes (must be before /:id to prevent conflicts)
router.get(
  "/",
  authorize("Super Admin", "Admin", "Sub Admin"),
  orderController.listAllOrders,
);

router.get("/:id", orderController.getOrderById);

router.patch(
  "/:id/status",
  authorize("Super Admin", "Admin", "Sub Admin"),
  body("status").notEmpty().withMessage("Status is required"),
  validate,
  orderController.updateOrderStatus,
);

export default router;
