import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const InvoiceCounter = sequelize.define(
  "InvoiceCounter",
  {
    date: {
      type: DataTypes.DATEONLY,
      primaryKey: true,
      allowNull: false,
      comment: "Calendar date for which this counter tracks invoice sequences",
    },
    lastSequence: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Last used invoice sequence number for this date",
    },
  },
  {
    tableName: "InvoiceCounters",
    timestamps: false,
  },
);

export default InvoiceCounter;
