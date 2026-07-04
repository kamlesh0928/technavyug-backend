import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const OrderCounter = sequelize.define(
  "OrderCounter",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      defaultValue: 1,
      comment: "Always 1 — single-row counter pattern",
    },
    lastSequence: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Last used global order sequence number",
    },
  },
  {
    tableName: "OrderCounters",
    timestamps: false,
  },
);

export default OrderCounter;
