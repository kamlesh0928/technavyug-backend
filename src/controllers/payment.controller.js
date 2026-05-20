import { Order, Payment } from "../models/index.js";
import Logger from "../utils/logger.js";

const initiatePayment = async (req, res) => {
  try {
    const { orderId, gateway } = req.body;

    if (!["Stripe", "Razorpay"].includes(gateway)) {
      return res
        .status(400)
        .json({ message: "Invalid payment gateway. Use Stripe or Razorpay" });
    }

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.userId !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (order.status !== "Pending") {
      return res
        .status(400)
        .json({ message: "Order is not in a payable state" });
    }

    // Create payment record
    const payment = await Payment.create({
      orderId: order.id,
      userId: req.user.id,
      gateway,
      amount: order.totalAmount,
      currency: req.body.currency || "INR",
    });

    let gatewayResponse = {};

    if (gateway === "Razorpay") {
      gatewayResponse = {
        provider: "Razorpay",
        message:
          "Razorpay order creation requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET env variables",
        paymentId: payment.id,
        amount: order.totalAmount,
        currency: payment.currency,
      };
    } else if (gateway === "Stripe") {
      gatewayResponse = {
        provider: "Stripe",
        message:
          "Stripe payment intent creation requires STRIPE_SECRET_KEY env variable",
        paymentId: payment.id,
        amount: order.totalAmount,
        currency: payment.currency,
      };
    }

    Logger.info("Payment initiated", { paymentId: payment.id, gateway });
    res.status(200).json({
      message: "Payment initiated",
      data: {
        paymentId: payment.id,
        gateway: gatewayResponse,
      },
    });
  } catch (error) {
    Logger.error("Error initiating payment", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const confirmPayment = async (req, res) => {
  try {
    const { paymentId, gatewayPaymentId, gatewayOrderId } = req.body;

    const payment = await Payment.findByPk(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    if (payment.userId !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    payment.gatewayPaymentId = gatewayPaymentId;
    payment.gatewayOrderId = gatewayOrderId;
    payment.status = "Completed";
    payment.metadata = req.body.metadata || null;
    await payment.save();

    // Update the order status
    const order = await Order.findByPk(payment.orderId);
    if (order) {
      order.status = "Processing";
      order.paymentId = gatewayPaymentId;
      order.paymentMethod = payment.gateway;
      await order.save();
    }

    Logger.info("Payment confirmed", { paymentId: payment.id });
    res
      .status(200)
      .json({ message: "Payment confirmed successfully", data: payment });
  } catch (error) {
    Logger.error("Error confirming payment", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id, {
      include: [{ model: Order }],
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (
      payment.userId !== req.user.id &&
      !["Super Admin", "Admin", "Sub Admin"].includes(req.user.role)
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.status(200).json({ data: payment });
  } catch (error) {
    Logger.error("Error fetching payment", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export default {
  initiatePayment,
  confirmPayment,
  getPaymentById,
};
