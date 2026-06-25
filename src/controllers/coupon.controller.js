import { Op } from "sequelize";
import { Coupon, CouponUsage } from "../models/index.js";
import { getPagination, getPaginatedResponse } from "../utils/pagination.js";
import Logger from "../utils/logger.js";

// Validate a coupon code (user-facing)
const validateCoupon = async (req, res) => {
  try {
    const { code, subtotal, applicableTo } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Coupon code is required" });
    }

    const coupon = await Coupon.findOne({
      where: { code: code.toUpperCase().trim() },
    });

    if (!coupon) {
      return res.status(404).json({ message: "Invalid coupon code" });
    }

    if (!coupon.isActive) {
      return res
        .status(400)
        .json({ message: "This coupon is no longer active" });
    }

    // Check if the coupon has started (startDate validation)
    const now = new Date();
    if (coupon.startDate && new Date(coupon.startDate) > now) {
      return res.status(400).json({ message: "This coupon is not yet active" });
    }

    // Check expiry with full datetime comparison
    if (new Date(coupon.expiryDate) < now) {
      return res.status(400).json({ message: "This coupon has expired" });
    }

    // Check usage limit
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return res
        .status(400)
        .json({ message: "This coupon has reached its usage limit" });
    }

    // Check applicability
    if (
      coupon.applicableTo !== "all" &&
      applicableTo &&
      coupon.applicableTo !== applicableTo
    ) {
      return res.status(400).json({
        message: `This coupon is only applicable to ${coupon.applicableTo} purchases`,
      });
    }

    // Check minimum order amount
    const orderAmount = parseFloat(subtotal || 0);
    if (orderAmount < parseFloat(coupon.minOrderAmount)) {
      return res.status(400).json({
        message: `Minimum order amount for this coupon is Rs. ${coupon.minOrderAmount}`,
      });
    }

    // Check if user already used this coupon
    const existingUsage = await CouponUsage.findOne({
      where: { couponId: coupon.id, userId: req.user.id },
    });

    if (existingUsage) {
      return res
        .status(400)
        .json({ message: "You have already used this coupon" });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = (orderAmount * parseFloat(coupon.discountValue)) / 100;
      if (coupon.maxDiscount) {
        discountAmount = Math.min(
          discountAmount,
          parseFloat(coupon.maxDiscount),
        );
      }
    } else {
      discountAmount = Math.min(parseFloat(coupon.discountValue), orderAmount);
    }

    discountAmount = Math.round(discountAmount * 100) / 100;

    res.status(200).json({
      message: "Coupon is valid",
      data: {
        couponId: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
        finalAmount: Math.max(0, orderAmount - discountAmount),
      },
    });
  } catch (error) {
    Logger.error("Error validating coupon", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Admin: List all coupons with remaining uses computation
const listCoupons = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { search, isActive } = req.query;

    const where = {};
    if (search) {
      where.code = { [Op.like]: `%${search.toUpperCase()}%` };
    }
    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    const { count, rows } = await Coupon.findAndCountAll({
      where,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    // Attach computed remainingUses to each coupon
    const enriched = rows.map((coupon) => {
      const plain = coupon.toJSON();
      plain.remainingUses =
        plain.usageLimit !== null
          ? Math.max(0, plain.usageLimit - plain.usedCount)
          : null;
      return plain;
    });

    res.status(200).json(getPaginatedResponse(enriched, count, page, limit));
  } catch (error) {
    Logger.error("Error listing coupons", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Admin: Create coupon
const createCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      maxDiscount,
      minOrderAmount,
      startDate,
      expiryDate,
      usageLimit,
      applicableTo,
    } = req.body;

    if (!code || !discountType || !discountValue || !expiryDate) {
      return res.status(400).json({
        message:
          "code, discountType, discountValue, and expiryDate are required",
      });
    }

    // Validate that expiryDate is after startDate if both are provided
    if (startDate && new Date(expiryDate) <= new Date(startDate)) {
      return res.status(400).json({
        message: "Expiry date must be after the start date",
      });
    }

    // Check for duplicate code
    const existing = await Coupon.findOne({
      where: { code: code.toUpperCase().trim() },
    });
    if (existing) {
      return res
        .status(409)
        .json({ message: "A coupon with this code already exists" });
    }

    const coupon = await Coupon.create({
      code,
      description: description || null,
      discountType,
      discountValue,
      maxDiscount: maxDiscount || null,
      minOrderAmount: minOrderAmount || 0,
      startDate: startDate || null,
      expiryDate,
      usageLimit: usageLimit || null,
      applicableTo: applicableTo || "all",
    });

    Logger.info("Coupon created", { couponId: coupon.id, code: coupon.code });
    res
      .status(201)
      .json({ message: "Coupon created successfully", data: coupon });
  } catch (error) {
    Logger.error("Error creating coupon", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Admin: Update coupon
const updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    const allowedFields = [
      "code",
      "description",
      "discountType",
      "discountValue",
      "maxDiscount",
      "minOrderAmount",
      "startDate",
      "expiryDate",
      "usageLimit",
      "applicableTo",
      "isActive",
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Validate date ordering if both are provided or being updated
    const newStart =
      updates.startDate !== undefined ? updates.startDate : coupon.startDate;
    const newExpiry =
      updates.expiryDate !== undefined ? updates.expiryDate : coupon.expiryDate;
    if (newStart && newExpiry && new Date(newExpiry) <= new Date(newStart)) {
      return res.status(400).json({
        message: "Expiry date must be after the start date",
      });
    }

    await coupon.update(updates);

    Logger.info("Coupon updated", { couponId: coupon.id });
    res
      .status(200)
      .json({ message: "Coupon updated successfully", data: coupon });
  } catch (error) {
    Logger.error("Error updating coupon", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Admin: Delete coupon
const deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    await coupon.destroy();

    Logger.info("Coupon deleted", { couponId: req.params.id });
    res.status(200).json({ message: "Coupon deleted successfully" });
  } catch (error) {
    Logger.error("Error deleting coupon", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export default {
  validateCoupon,
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
};
