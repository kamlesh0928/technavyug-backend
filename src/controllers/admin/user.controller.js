import { Op } from "sequelize";
import bcrypt from "bcryptjs";
import { User } from "../../models/index.js";
import { getPagination, getPaginatedResponse } from "../../utils/pagination.js";
import Logger from "../../utils/logger.js";
import sendEmail from "../../services/email.service.js";

const listUsers = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { role, status, search } = req.query;

    const where = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: { exclude: ["password"] },
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    Logger.error("Error listing users", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ data: user });
  } catch (error) {
    Logger.error("Error fetching user", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, role, status, phone, bio, avatar } = req.body;
    const oldStatus = user.status;

    if (name !== undefined) user.name = name;

    // Only 'Admin' and 'Super Admin' can change roles, 'Sub Admin' cannot
    if (role !== undefined) {
      if (!["Super Admin", "Admin"].includes(req.user.role)) {
        return res
          .status(403)
          .json({ message: "Only Admin can change user roles" });
      }

      if (role === "Super Admin" && req.user.role !== "Super Admin") {
        return res.status(403).json({
          message: "Only a Super Admin can assign the Super Admin role",
        });
      }

      if (user.role === "Super Admin" && req.user.role !== "Super Admin") {
        return res
          .status(403)
          .json({ message: "Cannot change the role of a Super Admin" });
      }

      user.role = role;
    }

    if (status !== undefined) user.status = status;
    if (phone !== undefined) user.phone = phone;
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    // Send email notification on status change
    if (status !== undefined && oldStatus !== status) {
      const subject = `Account Status Updated - Technavyug`;
      const message = `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #0f172a; text-align: center;">Account Status Update</h2>
          <p>Hello ${user.name},</p>
          <p>This is to inform you that your account status on <strong>Technavyug</strong> has been updated.</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="margin: 0; color: #64748b; font-size: 14px;">Current Status</p>
            <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: 800; color: ${status === "Active" ? "#10b981" : "#ef4444"}; text-transform: uppercase;">${status}</p>
          </div>
          <p>If you believe this was a mistake or have any questions regarding your account status, please reach out to our support team immediately.</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL_1 || process.env.FRONTEND_URL_2 || "https://technavyug.com"}" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Visit Website</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0 20px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">
            Technavyug Engineering Platform<br/>
            This is an automated security notification.
          </p>
        </div>
      `;
      try {
        await sendEmail(user.email, subject, message);
      } catch (emailError) {
        Logger.error("Failed to send status update email", emailError);
      }
    }

    const { password: _, ...userData } = user.get({ plain: true });
    Logger.info("User updated by admin", {
      userId: user.id,
      updatedBy: req.user.id,
    });
    res
      .status(200)
      .json({ message: "User updated successfully", data: userData });
  } catch (error) {
    Logger.error("Error updating user", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "Super Admin" && req.user.role !== "Super Admin") {
      return res
        .status(403)
        .json({ message: "Cannot delete a Super Admin user" });
    }
    if (user.role === "Admin" && req.user.role !== "Super Admin") {
      return res.status(403).json({ message: "Cannot delete an Admin user" });
    }

    await user.destroy();
    Logger.info("User deleted by admin", {
      userId: req.params.id,
      deletedBy: req.user.id,
    });
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    Logger.error("Error deleting user", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const blockUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "Super Admin" && req.user.role !== "Super Admin") {
      return res
        .status(403)
        .json({ message: "Cannot block a Super Admin user" });
    }
    if (user.role === "Admin" && req.user.role !== "Super Admin") {
      return res.status(403).json({ message: "Cannot block an Admin user" });
    }

    user.status = "Blocked";
    await user.save();

    Logger.info("User blocked", { userId: user.id, blockedBy: req.user.id });
    res.status(200).json({ message: "User blocked successfully" });
  } catch (error) {
    Logger.error("Error blocking user", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const unblockUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.status = "Active";
    await user.save();

    Logger.info("User unblocked", {
      userId: user.id,
      unblockedBy: req.user.id,
    });
    res.status(200).json({ message: "User unblocked successfully" });
  } catch (error) {
    Logger.error("Error unblocking user", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, password, role, status, phone, bio } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "User with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || "Student",
      status: status || "Active",
      phone: phone || null,
      bio: bio || null,
      emailVerified: true,
    });

    const { password: _, ...userData } = user.get({ plain: true });

    Logger.info("User created by admin", {
      userId: user.id,
      createdBy: req.user.id,
    });

    res
      .status(201)
      .json({ message: "User created successfully", data: userData });
  } catch (error) {
    Logger.error("Error creating user", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export default {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  blockUser,
  unblockUser,
};
