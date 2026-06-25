import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Coupon = sequelize.define(
  "Coupon",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Optional description or notes about this coupon",
    },
    discountType: {
      type: DataTypes.ENUM("percentage", "flat"),
      allowNull: false,
    },
    discountValue: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Percentage value or flat rupee amount",
    },
    maxDiscount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Cap for percentage-based discounts",
    },
    minOrderAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment:
        "Coupon becomes valid from this datetime. null = immediately valid",
    },
    expiryDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Coupon expires at this datetime",
    },
    usageLimit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment:
        "Total number of times this coupon can be used. null = unlimited",
    },
    usedCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    applicableTo: {
      type: DataTypes.ENUM("all", "course", "product"),
      defaultValue: "all",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    indexes: [{ fields: ["code"], unique: true }],
    hooks: {
      beforeCreate: (coupon) => {
        coupon.code = coupon.code.toUpperCase().trim();
      },
      beforeUpdate: (coupon) => {
        if (coupon.changed("code")) {
          coupon.code = coupon.code.toUpperCase().trim();
        }
      },
    },
  },
);

export default Coupon;
