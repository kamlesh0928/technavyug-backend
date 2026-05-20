import express from "express";
import { body } from "express-validator";
import couponController from "../controllers/coupon.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";

const router = express.Router();

router.use(authenticate);

// User-facing: validate coupon
router.post(
  "/validate",
  body("code").notEmpty().withMessage("Coupon code is required"),
  validate,
  couponController.validateCoupon,
);

// Admin CRUD
router.get(
  "/",
  authorize("Super Admin", "Admin", "Sub Admin"),
  couponController.listCoupons,
);

router.post(
  "/",
  authorize("Super Admin", "Admin", "Sub Admin"),
  body("code").notEmpty().withMessage("Coupon code is required"),
  body("discountType")
    .isIn(["percentage", "flat"])
    .withMessage("Discount type must be percentage or flat"),
  body("discountValue")
    .isFloat({ min: 0 })
    .withMessage("Discount value is required"),
  body("expiryDate").notEmpty().withMessage("Expiry date is required"),
  validate,
  couponController.createCoupon,
);

router.put(
  "/:id",
  authorize("Super Admin", "Admin", "Sub Admin"),
  couponController.updateCoupon,
);
router.delete(
  "/:id",
  authorize("Super Admin", "Admin", "Sub Admin"),
  couponController.deleteCoupon,
);

export default router;
