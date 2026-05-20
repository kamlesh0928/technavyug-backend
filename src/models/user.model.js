import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const User = sequelize.define("User", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  googleId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  authProvider: {
    type: DataTypes.ENUM("local", "google"),
    defaultValue: "local",
  },
  role: {
    type: DataTypes.ENUM(
      "Student",
      "Instructor",
      "Admin",
      "Sub Admin",
      "Super Admin",
      "Guest",
    ),
    defaultValue: "Student",
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  status: {
    type: DataTypes.ENUM("Active", "Blocked"),
    defaultValue: "Active",
  },
  avatar: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  currentStreak: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "Consecutive study days",
  },
  longestStreak: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "Best streak ever achieved",
  },
  lastStudyDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment:
      "Last date the student completed a lecture (IST, day starts at 6 AM)",
  },
});

export default User;
