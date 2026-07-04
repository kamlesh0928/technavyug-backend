import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Order = sequelize.define("Order", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  orderNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: "Sum of item prices before GST and discount",
  },
  gstAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: "Total GST amount (CGST + SGST)",
  },
  cgstAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: "Central GST (9%)",
  },
  sgstAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: "State GST (9%)",
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: "Final amount = subtotal + gstAmount - discountAmount",
  },
  discountAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: "Discount applied via coupon",
  },
  invoiceNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    comment: "Auto-generated invoice number e.g. TNY-INV-20260704-00001",
  },
  couponCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM(
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Refunded",
    ),
    defaultValue: "Pending",
  },
  addressId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: "Reference to saved address used for this order",
  },
  shippingAddress: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: "{ street, city, state, zipCode, country }",
  },
  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  paymentId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

export default Order;
