import { Op } from "sequelize";
import {
  Order,
  OrderItem,
  Product,
  User,
  Transaction,
  Course,
} from "../models/index.js";
import { getPagination, getPaginatedResponse } from "../utils/pagination.js";
import Logger from "../utils/logger.js";
import sendEmail from "../services/email.service.js";
import {
  generateOrderNumber,
  generateInvoiceNumber,
} from "../utils/idGenerators.js";
import orderStatusUpdateTemplate from "../templates/email/orderStatusUpdate.template.js";

const GST_RATE = parseFloat(process.env.GST_RATE || 18);

const createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Order must contain at least one item" });
    }

    // Validate products and calculate total with GST
    let subtotal = 0;
    let totalGST = 0;
    const orderItemsData = [];

    for (const item of items) {
      const product = await Product.findByPk(item.productId);
      if (!product) {
        return res.status(404).json({
          message: `Product not found: ${item.productId}`,
        });
      }

      if (product.status !== "Active") {
        return res.status(400).json({
          message: `Product is not available: ${product.name}`,
        });
      }

      if (product.type === "Physical" && product.stock < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for: ${product.name}`,
        });
      }

      const taxableAmount = parseFloat(product.price) * item.quantity;
      const gstAmount =
        Math.round(((taxableAmount * GST_RATE) / 100) * 100) / 100;
      const totalPrice = Math.round((taxableAmount + gstAmount) * 100) / 100;

      subtotal += taxableAmount;
      totalGST += gstAmount;

      orderItemsData.push({
        productId: product.id,
        quantity: item.quantity,
        price: product.price,
        gstRate: GST_RATE,
        gstAmount,
        totalPrice,
      });
    }

    const totalAmount = subtotal + totalGST;
    const cgstAmount = Math.round((totalGST / 2) * 100) / 100;
    const sgstAmount = Math.round((totalGST - cgstAmount) * 100) / 100;

    const order = await Order.create({
      orderNumber: await generateOrderNumber(),
      invoiceNumber: await generateInvoiceNumber(),
      userId: req.user.id,
      subtotal,
      gstAmount: totalGST,
      cgstAmount,
      sgstAmount,
      totalAmount,
      shippingAddress,
      paymentMethod,
      notes,
    });

    // Create order items and update stock
    for (const itemData of orderItemsData) {
      await OrderItem.create({
        orderId: order.id,
        ...itemData,
      });

      const product = await Product.findByPk(itemData.productId);
      if (product.type === "Physical") {
        product.stock -= itemData.quantity;
        await product.save();
      }
    }

    const fullOrder = await Order.findByPk(order.id, {
      include: [
        { model: OrderItem, as: "items", include: [{ model: Product }] },
      ],
    });

    Logger.info("Order created", { orderId: order.id, userId: req.user.id });
    res
      .status(201)
      .json({ message: "Order placed successfully", data: fullOrder });
  } catch (error) {
    Logger.error("Error creating order", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getMyOrders = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status } = req.query;

    const where = { userId: req.user.id };
    if (status) where.status = status;

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: OrderItem,
          as: "items",
          include: [{ model: Product, attributes: ["id", "name", "images"] }],
        },
      ],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    Logger.error("Error fetching orders", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        { model: OrderItem, as: "items", include: [{ model: Product }] },
        { model: User, attributes: ["id", "name", "email"] },
      ],
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Users can only view their own orders (unless admin)
    if (
      order.userId !== req.user.id &&
      !["Super Admin", "Admin", "Sub Admin"].includes(req.user.role)
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.status(200).json({ data: order });
  } catch (error) {
    Logger.error("Error fetching order", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const { status } = req.body;
    const validStatuses = [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Refunded",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid order status" });
    }

    // If cancelling, restore stock
    if (status === "Cancelled" && order.status !== "Cancelled") {
      const orderItems = await OrderItem.findAll({
        where: { orderId: order.id },
      });
      for (const item of orderItems) {
        const product = await Product.findByPk(item.productId);
        if (product && product.type === "Physical") {
          product.stock += item.quantity;
          await product.save();
        }
      }
    }

    order.status = status;
    await order.save();

    const statusDescriptions = {
      Pending: "Your order is awaiting processing.",
      Processing: "Your order is being prepared and will be shipped soon.",
      Shipped: "Your order has been shipped and is on its way to you.",
      Delivered: "Your order has been delivered successfully.",
      Cancelled: "Your order has been cancelled.",
      Refunded:
        "Your order has been refunded. The amount will be credited back to your account.",
    };

    // Send email asynchronously
    (async () => {
      try {
        const fullOrder = await Order.findByPk(order.id, {
          include: [
            { model: OrderItem, as: "items", include: [{ model: Product }] },
            { model: User },
          ],
        });
        if (fullOrder && fullOrder.User) {
          await sendEmail(
            fullOrder.User.email,
            `Order Status Update: ${fullOrder.orderNumber}`,
            orderStatusUpdateTemplate(
              fullOrder.User.name,
              fullOrder,
              status,
              statusDescriptions[status],
            ),
          );
        }
      } catch (err) {
        Logger.error("Failed to send order status update email", err);
      }
    })();

    Logger.info("Order status updated", { orderId: order.id, status });
    res
      .status(200)
      .json({ message: "Order status updated successfully", data: order });
  } catch (error) {
    Logger.error("Error updating order status", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Admin: list all orders
const listAllOrders = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, search } = req.query;

    const where = {};
    if (status) where.status = status;
    if (search) where.orderNumber = { [Op.like]: `%${search}%` };

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [
        { model: User, attributes: ["id", "name", "email"] },
        {
          model: OrderItem,
          as: "items",
          include: [{ model: Product, attributes: ["id", "name"] }],
        },
      ],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    Logger.error("Error listing all orders", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const listAllTransactions = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, search } = req.query;

    const where = { paymentType: "course" };
    if (status) where.status = status;
    if (search) where.merchantOrderId = { [Op.like]: `%${search}%` };

    const { count, rows } = await Transaction.findAndCountAll({
      where,
      include: [
        { model: User, attributes: ["id", "name", "email"] },
        {
          model: Course,
          attributes: ["id", "title", "slug", "price", "thumbnail"],
        },
      ],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    Logger.error("Error listing all transactions", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export default {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  listAllOrders,
  listAllTransactions,
};
