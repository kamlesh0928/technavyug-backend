import crypto from "crypto";

import {
  Transaction,
  Course,
  Enrollment,
  Order,
  OrderItem,
  Product,
  User,
  Coupon,
  CouponUsage,
  Address,
} from "../models/index.js";

import phonepeService from "../services/phonepe.service.js";
import sendEmail from "../services/email.service.js";

import coursePurchaseUserTemplate from "../templates/email/coursePurchaseUser.template.js";
import coursePurchaseAdminTemplate from "../templates/email/coursePurchaseAdmin.template.js";
import orderConfirmationUserTemplate from "../templates/email/orderConfirmationUser.template.js";
import orderConfirmationAdminTemplate from "../templates/email/orderConfirmationAdmin.template.js";
import invoiceUserTemplate from "../templates/email/invoiceUser.template.js";

import Logger from "../utils/logger.js";

// Helper: Increment coupon usage and auto-deactivate if limit is reached
const incrementCouponUsage = async (couponId) => {
  await Coupon.increment("usedCount", { where: { id: couponId } });
  const coupon = await Coupon.findByPk(couponId);
  if (
    coupon &&
    coupon.usageLimit !== null &&
    coupon.usedCount >= coupon.usageLimit
  ) {
    coupon.isActive = false;
    await coupon.save();
    Logger.info("Coupon auto-deactivated (usage limit reached)", { couponId });
  }
};

const GST_RATE = parseFloat(process.env.GST_RATE || 18);

const generateMerchantOrderId = (prefix) => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${ts}-${rand}`;
};

const generateOrderNumber = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ORD-${ts}-${rand}`;
};

const generateInvoiceNumber = () => {
  const now = new Date();
  const year = now.getFullYear();
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `INV-${year}-${ts}${rand}`;
};

const getCompanyInfo = () => ({
  name: process.env.COMPANY_NAME || "Technavyug Pvt. Ltd.",
  gstin: process.env.COMPANY_GSTIN || "",
  address: process.env.COMPANY_ADDRESS || "India",
});

const getFrontendUrl = () =>
  process.env.FRONTEND_URL_1 || process.env.FRONTEND_URL_2;

// Helper: Calculate GST for a line item
const calculateItemGST = (price, quantity, gstRate = GST_RATE) => {
  const taxableAmount = parseFloat(price) * quantity;
  const gstAmount = Math.round(((taxableAmount * gstRate) / 100) * 100) / 100;
  const totalPrice = Math.round((taxableAmount + gstAmount) * 100) / 100;
  return { taxableAmount, gstAmount, totalPrice, gstRate };
};

// Helper to apply coupon and record usage
const applyCoupon = async (couponCode, subtotal, userId, applicableTo) => {
  if (!couponCode) return { discountAmount: 0, couponId: null };

  const coupon = await Coupon.findOne({
    where: { code: couponCode.toUpperCase().trim() },
  });

  if (!coupon || !coupon.isActive) return { discountAmount: 0, couponId: null };

  const now = new Date();

  // Check if the coupon has started
  if (coupon.startDate && new Date(coupon.startDate) > now)
    return { discountAmount: 0, couponId: null };

  // Check expiry with full datetime comparison
  if (new Date(coupon.expiryDate) < now)
    return { discountAmount: 0, couponId: null };

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
    return { discountAmount: 0, couponId: null };
  if (coupon.applicableTo !== "all" && coupon.applicableTo !== applicableTo)
    return { discountAmount: 0, couponId: null };

  const existing = await CouponUsage.findOne({
    where: { couponId: coupon.id, userId },
  });
  if (existing) return { discountAmount: 0, couponId: null };

  // Check minimum order amount on base subtotal
  if (
    coupon.minOrderAmount &&
    parseFloat(subtotal) < parseFloat(coupon.minOrderAmount)
  )
    return { discountAmount: 0, couponId: null };

  let discount;
  if (coupon.discountType === "percentage") {
    discount = (subtotal * parseFloat(coupon.discountValue)) / 100;
    if (coupon.maxDiscount)
      discount = Math.min(discount, parseFloat(coupon.maxDiscount));
  } else {
    discount = Math.min(parseFloat(coupon.discountValue), subtotal);
  }

  return {
    discountAmount: Math.round(discount * 100) / 100,
    couponId: coupon.id,
  };
};

// Helper: Send all order-related emails (user confirmation, invoice, admin, support)
const sendOrderEmails = async (transactionOrOrder) => {
  try {
    const orderId = transactionOrOrder.orderId || transactionOrOrder.id;
    const userId = transactionOrOrder.userId;

    const user = await User.findByPk(userId);
    const fullOrder = await Order.findByPk(orderId, {
      include: [
        { model: OrderItem, as: "items", include: [{ model: Product }] },
      ],
    });

    if (!user || !fullOrder) {
      Logger.error("sendOrderEmails: user or order not found", {
        userId,
        orderId,
      });
      return;
    }

    const companyInfo = getCompanyInfo();

    // 1. User — Order Confirmation
    await sendEmail(
      user.email,
      `Order Confirmed: ${fullOrder.orderNumber}`,
      orderConfirmationUserTemplate(user.name, fullOrder),
    );

    // 2. User — Tax Invoice
    await sendEmail(
      user.email,
      `Tax Invoice: ${fullOrder.invoiceNumber || fullOrder.orderNumber}`,
      invoiceUserTemplate(user, fullOrder, companyInfo),
    );

    // 3. Admin — Order Notification (support@technavyug.com)
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendEmail(
        adminEmail,
        `New Order: ${fullOrder.orderNumber} — ₹${parseFloat(fullOrder.totalAmount).toFixed(2)}`,
        orderConfirmationAdminTemplate(user.name, user.email, fullOrder),
      );
    }

    // 4. Notification Email (technavyug@gmail.com) — Send copy if different from admin
    const notificationEmail = process.env.NOTIFICATION_EMAIL;
    if (notificationEmail && notificationEmail !== adminEmail) {
      await sendEmail(
        notificationEmail,
        `New Order: ${fullOrder.orderNumber} — ₹${parseFloat(fullOrder.totalAmount).toFixed(2)}`,
        orderConfirmationAdminTemplate(user.name, user.email, fullOrder),
      );
    }

    Logger.info("All order emails sent successfully", {
      orderNumber: fullOrder.orderNumber,
    });
  } catch (emailErr) {
    Logger.error("Failed to send order emails", emailErr);
  }
};

// POST /initiate-course-payment
const initiateCoursePurchase = async (req, res) => {
  try {
    const { courseId, couponCode } = req.body;
    if (!courseId)
      return res.status(400).json({ message: "courseId is required" });

    const course = await Course.findByPk(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (course.status !== "Published")
      return res
        .status(400)
        .json({ message: "Course is not available for purchase" });

    const price = parseFloat(course.price);
    if (price <= 0)
      return res
        .status(400)
        .json({ message: "This is a free course. Enroll directly." });

    // Check if user already owns the course
    const existing = await Enrollment.findOne({
      where: { userId: req.user.id, courseId, status: ["Active", "Completed"] },
    });
    if (existing)
      return res.status(400).json({ message: "You already own this course" });

    // Check for a pending transaction (idempotency)
    const pendingTxn = await Transaction.findOne({
      where: {
        userId: req.user.id,
        courseId,
        paymentType: "course",
        status: "Pending",
      },
    });
    if (pendingTxn) {
      // Re-initiate payment for the existing pending transaction
      const redirectUrl = `${getFrontendUrl()}/payment-status?merchantOrderId=${pendingTxn.merchantOrderId}&type=course`;
      const amountInPaise = Math.round(parseFloat(pendingTxn.amount) * 100);
      const ppResponse = await phonepeService.initiatePayment(
        pendingTxn.merchantOrderId,
        amountInPaise,
        redirectUrl,
      );
      return res.status(200).json({
        message: "Payment re-initiated",
        data: {
          checkoutUrl: ppResponse.redirectUrl,
          merchantOrderId: pendingTxn.merchantOrderId,
        },
      });
    }

    // Apply coupon on course base price
    const { discountAmount, couponId } = await applyCoupon(
      couponCode,
      price,
      req.user.id,
      "course",
    );
    const discountedBase = Math.max(0, price - discountAmount);

    // Calculate GST on discounted base price
    const gstAmount =
      Math.round(((discountedBase * GST_RATE) / 100) * 100) / 100;
    const finalAmount = Math.round((discountedBase + gstAmount) * 100) / 100;

    const originalGST = Math.round(((price * GST_RATE) / 100) * 100) / 100;
    const originalAmountWithGST = Math.round((price + originalGST) * 100) / 100;

    if (finalAmount <= 0) {
      // Free after coupon - grant access directly
      await Enrollment.create({ userId: req.user.id, courseId });
      await Course.increment("totalEnrollments", { where: { id: courseId } });
      if (couponId) {
        await incrementCouponUsage(couponId);
      }
      return res.status(200).json({
        message: "Course enrolled successfully (coupon covered full amount)",
        data: { paid: false },
      });
    }

    const merchantOrderId = generateMerchantOrderId("CRS");

    const transaction = await Transaction.create({
      merchantOrderId,
      userId: req.user.id,
      amount: finalAmount,
      originalAmount: originalAmountWithGST,
      status: "Pending",
      paymentType: "course",
      courseId,
      couponId,
    });

    const redirectUrl = `${getFrontendUrl()}/payment-status?merchantOrderId=${merchantOrderId}&type=course`;
    const amountInPaise = Math.round(finalAmount * 100);

    const ppResponse = await phonepeService.initiatePayment(
      merchantOrderId,
      amountInPaise,
      redirectUrl,
    );

    Logger.info("Course payment initiated", {
      transactionId: transaction.id,
      merchantOrderId,
    });
    res.status(200).json({
      message: "Payment initiated",
      data: {
        checkoutUrl: ppResponse.redirectUrl,
        merchantOrderId,
        transactionId: transaction.id,
      },
    });
  } catch (error) {
    Logger.error("Error initiating course payment", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /course-payment-status/:merchantOrderId
const getCoursePurchaseStatus = async (req, res) => {
  try {
    const { merchantOrderId } = req.params;
    const transaction = await Transaction.findOne({
      where: { merchantOrderId },
    });
    if (!transaction)
      return res.status(404).json({ message: "Transaction not found" });

    if (transaction.userId !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    if (transaction.status !== "Pending") {
      return res
        .status(200)
        .json({ data: { status: transaction.status, transaction } });
    }

    // Verify with PhonePe
    const ppStatus = await phonepeService.getPaymentStatus(merchantOrderId);
    const state = ppStatus?.state;

    if (state === "COMPLETED") {
      transaction.status = "Success";
      transaction.phonepeTransactionId = ppStatus.transactionId || null;
      transaction.metadata = ppStatus;
      await transaction.save();

      // Grant course access
      const [enrollment] = await Enrollment.findOrCreate({
        where: { userId: transaction.userId, courseId: transaction.courseId },
        defaults: { status: "Active" },
      });
      if (enrollment.status === "Cancelled") {
        enrollment.status = "Active";
        enrollment.enrolledAt = new Date();
        await enrollment.save();
      }

      await Course.increment("totalEnrollments", {
        where: { id: transaction.courseId },
      });

      // Record coupon usage
      if (transaction.couponId) {
        await CouponUsage.findOrCreate({
          where: { couponId: transaction.couponId, userId: transaction.userId },
          defaults: { transactionId: transaction.id },
        });
        await incrementCouponUsage(transaction.couponId);
      }

      // Send emails asynchronously
      (async () => {
        try {
          const user = await User.findByPk(transaction.userId);
          const course = await Course.findByPk(transaction.courseId);
          const frontendUrl = getFrontendUrl();

          // User email
          await sendEmail(
            user.email,
            `Purchase Confirmed: ${course.title}`,
            coursePurchaseUserTemplate(
              user.name,
              course.title,
              transaction.amount,
              `${frontendUrl}/student/courses`,
            ),
          );
          // Admin email (support@technavyug.com)
          const adminEmail = process.env.ADMIN_EMAIL;
          if (adminEmail) {
            await sendEmail(
              adminEmail,
              `New Course Purchase: ${course.title}`,
              coursePurchaseAdminTemplate(
                user.name,
                user.email,
                course.title,
                transaction.amount,
              ),
            );
          }
          // Notification email (technavyug@gmail.com)
          const notificationEmail = process.env.NOTIFICATION_EMAIL;
          if (notificationEmail && notificationEmail !== adminEmail) {
            await sendEmail(
              notificationEmail,
              `New Course Purchase: ${course.title}`,
              coursePurchaseAdminTemplate(
                user.name,
                user.email,
                course.title,
                transaction.amount,
              ),
            );
          }
        } catch (emailErr) {
          Logger.error("Failed to send course purchase emails", emailErr);
        }
      })();

      return res.status(200).json({ data: { status: "Success", transaction } });
    } else if (state === "FAILED") {
      transaction.status = "Failed";
      transaction.metadata = ppStatus;
      await transaction.save();
      return res.status(200).json({ data: { status: "Failed", transaction } });
    }

    // Still pending
    return res.status(200).json({ data: { status: "Pending", transaction } });
  } catch (error) {
    Logger.error("Error checking course payment status", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /initiate-order-payment
const initiateOrderPayment = async (req, res) => {
  try {
    const { items, addressId, couponCode, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0)
      return res
        .status(400)
        .json({ message: "Order must contain at least one item" });
    if (!addressId)
      return res.status(400).json({ message: "Shipping address is required" });

    // Validate address belongs to user
    const address = await Address.findByPk(addressId);
    if (!address || address.userId !== req.user.id)
      return res.status(400).json({ message: "Invalid shipping address" });

    // Validate products and calculate subtotal + GST
    let subtotal = 0;
    let totalGST = 0;
    const orderItemsData = [];

    for (const item of items) {
      const product = await Product.findByPk(item.productId);
      if (!product)
        return res
          .status(404)
          .json({ message: `Product not found: ${item.productId}` });
      if (product.status !== "Active")
        return res
          .status(400)
          .json({ message: `Product is not available: ${product.name}` });
      if (product.type === "Physical" && product.stock < item.quantity)
        return res
          .status(400)
          .json({ message: `Insufficient stock for: ${product.name}` });

      const { taxableAmount, gstAmount, totalPrice, gstRate } =
        calculateItemGST(product.price, item.quantity);

      subtotal += taxableAmount;
      totalGST += gstAmount;

      orderItemsData.push({
        productId: product.id,
        quantity: item.quantity,
        price: product.price,
        gstRate,
        gstAmount,
        totalPrice,
      });
    }

    // Apply coupon on base subtotal (WITHOUT GST)
    const { discountAmount, couponId } = await applyCoupon(
      couponCode,
      subtotal,
      req.user.id,
      "product",
    );
    const discountedSubtotal = Math.max(0, subtotal - discountAmount);

    // Calculate GST on discounted subtotal
    totalGST = Math.round(((discountedSubtotal * GST_RATE) / 100) * 100) / 100;
    const cgstAmount = Math.round((totalGST / 2) * 100) / 100;
    const sgstAmount = Math.round((totalGST - cgstAmount) * 100) / 100;

    const totalAmount = Math.round((discountedSubtotal + totalGST) * 100) / 100;

    const originalGST = Math.round(((subtotal * GST_RATE) / 100) * 100) / 100;
    const amountBeforeDiscount =
      Math.round((subtotal + originalGST) * 100) / 100;

    // Create order with Pending status (stock not reduced yet)
    const shippingAddressJson = {
      name: address.name,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
    };

    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      invoiceNumber: generateInvoiceNumber(),
      userId: req.user.id,
      subtotal,
      gstAmount: totalGST,
      cgstAmount,
      sgstAmount,
      totalAmount,
      discountAmount,
      couponCode: couponCode ? couponCode.toUpperCase().trim() : null,
      addressId,
      shippingAddress: shippingAddressJson,
      paymentMethod: "PhonePe",
      notes,
    });

    for (const itemData of orderItemsData) {
      await OrderItem.create({ orderId: order.id, ...itemData });
    }

    const merchantOrderId = generateMerchantOrderId("ORD");
    const transaction = await Transaction.create({
      merchantOrderId,
      userId: req.user.id,
      amount: totalAmount,
      originalAmount: amountBeforeDiscount,
      status: "Pending",
      paymentType: "product",
      orderId: order.id,
      couponId,
    });

    const redirectUrl = `${getFrontendUrl()}/payment-status?merchantOrderId=${merchantOrderId}&type=product`;
    const amountInPaise = Math.round(totalAmount * 100);

    const ppResponse = await phonepeService.initiatePayment(
      merchantOrderId,
      amountInPaise,
      redirectUrl,
    );

    Logger.info("Order payment initiated", {
      orderId: order.id,
      merchantOrderId,
    });
    res.status(200).json({
      message: "Payment initiated",
      data: {
        checkoutUrl: ppResponse.redirectUrl,
        merchantOrderId,
        orderId: order.id,
        transactionId: transaction.id,
        // Send GST breakdown back to frontend
        gstBreakdown: {
          subtotal,
          gstAmount: totalGST,
          cgstAmount,
          sgstAmount,
          discountAmount,
          totalAmount,
        },
      },
    });
  } catch (error) {
    Logger.error("Error initiating order payment", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /order-payment-status/:merchantOrderId
const getOrderPaymentStatus = async (req, res) => {
  try {
    const { merchantOrderId } = req.params;
    const transaction = await Transaction.findOne({
      where: { merchantOrderId },
    });
    if (!transaction)
      return res.status(404).json({ message: "Transaction not found" });
    if (transaction.userId !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    if (transaction.status !== "Pending")
      return res
        .status(200)
        .json({ data: { status: transaction.status, transaction } });

    const ppStatus = await phonepeService.getPaymentStatus(merchantOrderId);
    const state = ppStatus?.state;

    if (state === "COMPLETED") {
      transaction.status = "Success";
      transaction.phonepeTransactionId = ppStatus.transactionId || null;
      transaction.metadata = ppStatus;
      await transaction.save();

      // Update order status
      const order = await Order.findByPk(transaction.orderId);
      if (order) {
        order.status = "Processing";
        order.paymentId = transaction.phonepeTransactionId;
        await order.save();

        // Reduce stock now
        const orderItems = await OrderItem.findAll({
          where: { orderId: order.id },
        });
        for (const item of orderItems) {
          const product = await Product.findByPk(item.productId);
          if (product && product.type === "Physical") {
            product.stock = Math.max(0, product.stock - item.quantity);
            await product.save();
          }
        }
      }

      // Record coupon usage
      if (transaction.couponId) {
        await CouponUsage.findOrCreate({
          where: { couponId: transaction.couponId, userId: transaction.userId },
          defaults: { transactionId: transaction.id },
        });
        await incrementCouponUsage(transaction.couponId);
      }

      // Send all order emails asynchronously
      (async () => {
        await sendOrderEmails(transaction);
      })();

      return res.status(200).json({ data: { status: "Success", transaction } });
    } else if (state === "FAILED") {
      transaction.status = "Failed";
      transaction.metadata = ppStatus;
      await transaction.save();

      const order = await Order.findByPk(transaction.orderId);
      if (order && order.status === "Pending") {
        order.status = "Cancelled";
        await order.save();
      }
      return res.status(200).json({ data: { status: "Failed", transaction } });
    }

    return res.status(200).json({ data: { status: "Pending", transaction } });
  } catch (error) {
    Logger.error("Error checking order payment status", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /webhook (no auth - PhonePe server callback)
const handleWebhook = async (req, res) => {
  try {
    const { merchantOrderId, state, transactionId } = req.body;
    Logger.info("PhonePe webhook received", { merchantOrderId, state });

    if (!merchantOrderId)
      return res.status(400).json({ message: "Invalid webhook payload" });

    const transaction = await Transaction.findOne({
      where: { merchantOrderId },
    });
    if (!transaction)
      return res.status(404).json({ message: "Transaction not found" });
    if (transaction.status !== "Pending")
      return res.status(200).json({ message: "Already processed" });

    // Verify status with PhonePe directly (never trust webhook data alone)
    const ppStatus = await phonepeService.getPaymentStatus(merchantOrderId);
    const verifiedState = ppStatus?.state;

    if (verifiedState === "COMPLETED" && transaction.status === "Pending") {
      transaction.status = "Success";
      transaction.phonepeTransactionId =
        ppStatus.transactionId || transactionId;
      transaction.metadata = ppStatus;
      await transaction.save();

      if (transaction.paymentType === "course") {
        await Enrollment.findOrCreate({
          where: { userId: transaction.userId, courseId: transaction.courseId },
          defaults: { status: "Active" },
        });
        await Course.increment("totalEnrollments", {
          where: { id: transaction.courseId },
        });
      } else if (transaction.paymentType === "product") {
        const order = await Order.findByPk(transaction.orderId);
        if (order) {
          order.status = "Processing";
          order.paymentId = transaction.phonepeTransactionId;
          await order.save();
          const orderItems = await OrderItem.findAll({
            where: { orderId: order.id },
          });
          for (const item of orderItems) {
            const product = await Product.findByPk(item.productId);
            if (product && product.type === "Physical") {
              product.stock = Math.max(0, product.stock - item.quantity);
              await product.save();
            }
          }
        }

        // Send order emails from webhook too (in case status check didn't trigger)
        (async () => {
          await sendOrderEmails(transaction);
        })();
      }

      if (transaction.couponId) {
        await CouponUsage.findOrCreate({
          where: { couponId: transaction.couponId, userId: transaction.userId },
          defaults: { transactionId: transaction.id },
        });
        await incrementCouponUsage(transaction.couponId);
      }
    } else if (verifiedState === "FAILED") {
      transaction.status = "Failed";
      transaction.metadata = ppStatus;
      await transaction.save();
      if (transaction.paymentType === "product") {
        const order = await Order.findByPk(transaction.orderId);
        if (order && order.status === "Pending") {
          order.status = "Cancelled";
          await order.save();
        }
      }
    }

    res.status(200).json({ message: "Webhook processed" });
  } catch (error) {
    Logger.error("Error handling PhonePe webhook", error);
    res.status(200).json({ message: "Webhook received" });
  }
};

// GET /transaction/:id
const getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findByPk(req.params.id, {
      include: [
        {
          model: Course,
          attributes: ["id", "title", "slug", "thumbnail", "price"],
        },
        { model: Order },
        {
          model: Coupon,
          attributes: ["id", "code", "discountType", "discountValue"],
        },
      ],
    });
    if (!transaction)
      return res.status(404).json({ message: "Transaction not found" });
    if (
      transaction.userId !== req.user.id &&
      !["Super Admin", "Admin", "Sub Admin"].includes(req.user.role)
    )
      return res.status(403).json({ message: "Not authorized" });

    res.status(200).json({ data: transaction });
  } catch (error) {
    Logger.error("Error fetching transaction", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export default {
  initiateCoursePurchase,
  getCoursePurchaseStatus,
  initiateOrderPayment,
  getOrderPaymentStatus,
  handleWebhook,
  getTransaction,
};
