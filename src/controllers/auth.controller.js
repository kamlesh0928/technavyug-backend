import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";

import { User, VerificationToken, RefreshToken } from "../models/index.js";

import sendEmail from "../services/email.service.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../services/token.service.js";
import admin from "../config/firebase.js";

import verificationEmailTemplate from "../templates/email/verifyEmail.template.js";
import resetPasswordTemplate from "../templates/email/resetPassword.template.js";

import Logger from "../utils/logger.js";

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      Logger.warn("Registration attempt with existing email", { email });
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "Student", // Default to Student role
      authProvider: "local",
    });

    const verificationToken = crypto.randomBytes(32).toString("hex");
    await VerificationToken.create({
      userId: user.id,
      token: verificationToken,
      type: "VERIFY_EMAIL",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const frontendUrl =
      process.env.FRONTEND_URL_1 || process.env.FRONTEND_URL_2;
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
    try {
      await sendEmail(
        user.email,
        "Verify your email",
        verificationEmailTemplate(user.name, verificationUrl),
      );
    } catch {
      Logger.warn("Failed to send verification email, but user was created", {
        userId: user.id,
      });
    }

    Logger.info("User registered successfully", { userId: user.id });
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    Logger.error("Error during user registration", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      Logger.warn("Resend verification requested for non-existent email", {
        email,
      });
      return res.status(404).json({ message: "User not found" });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    // Delete any existing verification tokens for this user
    await VerificationToken.destroy({
      where: { userId: user.id, type: "VERIFY_EMAIL" },
    });

    const verificationToken = crypto.randomBytes(32).toString("hex");
    await VerificationToken.create({
      userId: user.id,
      token: verificationToken,
      type: "VERIFY_EMAIL",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const frontendUrl =
      process.env.FRONTEND_URL_1 || process.env.FRONTEND_URL_2;
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    await sendEmail(
      user.email,
      "Verify your email",
      verificationEmailTemplate(user.name, verificationUrl),
    );

    Logger.info("Verification email resent successfully", { userId: user.id });
    res.status(200).json({ message: "Verification email sent successfully" });
  } catch (error) {
    Logger.error("Error during resending verification email", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const token = req.query?.token || req.body?.token;

    if (!token) {
      Logger.warn("Email verification attempted without a token");
      return res
        .status(400)
        .json({ message: "Verification token is required" });
    }

    const record = await VerificationToken.findOne({
      where: {
        token,
        type: "VERIFY_EMAIL",
        expiresAt: { [Op.gt]: new Date() },
      },
    });

    if (!record) {
      Logger.warn("Attempt to use invalid or expired verification token");
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const user = await User.findByPk(record.userId);
    if (!user) {
      Logger.error("User associated with verification token not found", {
        userId: record.userId,
      });
      return res.status(404).json({ message: "User not found" });
    }

    if (user.emailVerified) {
      Logger.info("User attempted to verify an already verified email", {
        userId: user.id,
      });
      await VerificationToken.destroy({ where: { id: record.id } });
      return res.status(400).json({ message: "Email is already verified" });
    }

    user.emailVerified = true;
    await user.save();

    await VerificationToken.destroy({ where: { id: record.id } });

    Logger.info("Email verified successfully", { userId: user.id });
    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    Logger.error("Error during email verification", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      Logger.warn("Login attempt with non-existent email", { email });
      return res.status(404).json({ message: "User not found" });
    }

    if (user.status === "Blocked") {
      Logger.warn("Login attempt by blocked user", { email });
      return res.status(403).json({ message: "Account has been blocked" });
    }

    if (!user.password) {
      return res.status(400).json({
        message:
          "This account was created using Google Sign-In. Please login with Google or add a password first.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      Logger.warn("Invalid password attempt", { email });

      return res.status(401).json({
        message: "Email or password is incorrect",
      });
    }

    if (user.emailVerified == 0) {
      Logger.warn("Login attempt with unverified email", { email });
      return res
        .status(401)
        .json({ message: "Please verify your email before logging in" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user, rememberMe);

    const refreshTokenMaxAge = rememberMe
      ? 7 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;

    await RefreshToken.create({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + refreshTokenMaxAge),
    });

    user.lastLoginAt = new Date();
    await user.save();

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: refreshTokenMaxAge,
    });

    Logger.info("User logged in successfully", { userId: user.id });
    res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,

        authProvider: user.authProvider,
        passwordSet: !!user.password,
      },
    });
  } catch (error) {
    Logger.error("Error during user login", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const refreshAccessToken = async (req, res) => {
  try {
    const token = req.body.refreshToken || req.cookies?.refreshToken;

    if (!token) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    const storedToken = await RefreshToken.findOne({
      where: {
        token,
        isRevoked: false,
        expiresAt: { [Op.gt]: new Date() },
      },
    });

    if (!storedToken) {
      return res
        .status(401)
        .json({ message: "Invalid or expired refresh token" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      storedToken.isRevoked = true;
      await storedToken.save();
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const user = await User.findByPk(decoded.id);
    if (!user || user.status === "Blocked") {
      return res.status(401).json({ message: "User not found or blocked" });
    }

    const newAccessToken = generateAccessToken(user);

    Logger.info("Access token refreshed", { userId: user.id });
    res.status(200).json({ accessToken: newAccessToken });
  } catch (error) {
    Logger.error("Error refreshing access token", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const logout = async (req, res) => {
  try {
    const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;

    if (refreshToken) {
      try {
        await RefreshToken.update(
          { isRevoked: true },
          { where: { token: refreshToken } },
        );
      } catch (revocationError) {
        Logger.error(
          "Failed to revoke refresh token during logout",
          revocationError,
        );
        // Continue with logout anyway
      }
    }

    res.clearCookie("refreshToken");

    Logger.info("User logged out successfully");
    res.status(200).json({ message: "User logged out successfully" });
  } catch (error) {
    Logger.error("Error during user logout", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const addPassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        message: "Password is required",
      });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Prevent overwrite
    if (user.password) {
      return res.status(400).json({
        message: "Password already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;

    await user.save();

    Logger.info("Password added successfully", {
      userId: user.id,
    });

    res.status(200).json({
      message: "Password added successfully",

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,

        authProvider: user.authProvider,
        passwordSet: true,
        googleId: user.googleId,
      },
    });
  } catch (error) {
    Logger.error("Error adding password", error);

    res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      Logger.warn("Forgot password requested for unknown email", { email });
      return res.status(404).json({ message: "User not found" });
    }

    const token = crypto.randomBytes(32).toString("hex");

    await VerificationToken.create({
      userId: user.id,
      token,
      type: "RESET_PASSWORD",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const resetUrl = `${process.env.FRONTEND_URL_1 || process.env.FRONTEND_URL_2}/reset-password?token=${token}`;
    try {
      await sendEmail(
        user.email,
        "Reset Password",
        resetPasswordTemplate(user.name, resetUrl),
      );
    } catch {
      Logger.warn("Failed to send password reset email", { email });
    }

    Logger.info("Password reset email sent successfully", { email });
    res.status(200).json({ message: "Password reset email sent successfully" });
  } catch (error) {
    Logger.error("Error during forgot password", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const token = req.query.token || req.body.token;
    const { password } = req.body;

    const record = await VerificationToken.findOne({
      where: {
        token,
        type: "RESET_PASSWORD",
        expiresAt: { [Op.gt]: new Date() },
      },
    });

    if (!record) {
      Logger.warn("Attempt to use invalid or expired reset token");
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const user = await User.findByPk(record.userId);
    if (!user) {
      Logger.error("User associated with reset token not found", {
        userId: record.userId,
      });
      return res.status(404).json({ message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    await VerificationToken.destroy({ where: { token } });

    // Revoke all existing refresh tokens for security
    await RefreshToken.update(
      { isRevoked: true },
      { where: { userId: user.id } },
    );

    Logger.info("Password reset successfully", { userId: user.id });
    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    Logger.error("Error during reset password", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { password, ...userData } = user.toJSON();
    userData.passwordSet = !!password;

    res.status(200).json({ data: userData });
  } catch (error) {
    Logger.error("Error fetching user profile", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, phone, bio, avatar } = req.body;
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    const { password: _password, ...userData } = user.toJSON();
    Logger.info("User profile updated", { userId: user.id });
    res
      .status(200)
      .json({ message: "Profile updated successfully", data: userData });
  } catch (error) {
    Logger.error("Error updating user profile", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    // Revoke all refresh tokens after password change
    await RefreshToken.update(
      { isRevoked: true },
      { where: { userId: user.id } },
    );

    Logger.info("Password changed successfully", { userId: user.id });
    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    Logger.error("Error changing password", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Password is incorrect" });
    }

    await user.destroy();

    // Revoke all refresh tokens
    await RefreshToken.destroy({ where: { userId: user.id } });

    res.clearCookie("refreshToken");

    Logger.info("User deleted their own account", { userId: user.id });
    res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    Logger.error("Error deleting account", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        message: "Firebase ID token is required",
      });
    }

    let decodedToken;

    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (firebaseError) {
      Logger.warn("Invalid Firebase token", {
        error: firebaseError.message,
      });

      return res.status(401).json({
        message: "Invalid Google token",
      });
    }

    const { email, name, picture, uid } = decodedToken;

    let user = await User.findOne({ where: { email } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;

      user = await User.create({
        name: name || "Google User",
        email,
        googleId: uid,
        authProvider: "google",
        emailVerified: true,
        avatar: picture,
        role: "Student",
        lastLoginAt: new Date(),
      });

      Logger.info("New user registered via Google", {
        userId: user.id,
      });
    } else {
      if (user.status === "Blocked") {
        Logger.warn("Blocked user attempted Google login", {
          email,
        });

        return res.status(403).json({
          message: "Account has been blocked",
        });
      }

      if (!user.googleId) user.googleId = uid;
      if (!user.authProvider) user.authProvider = "google";
      if (!user.avatar && picture) user.avatar = picture;

      user.emailVerified = true;
      user.lastLoginAt = new Date();

      await user.save();

      Logger.info("Existing user logged in via Google", {
        userId: user.id,
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user, true);

    const refreshTokenMaxAge = 7 * 24 * 60 * 60 * 1000;

    await RefreshToken.create({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + refreshTokenMaxAge),
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: refreshTokenMaxAge,
    });

    return res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        authProvider: user.authProvider,
        passwordSet: !!user.password,
        emailVerified: user.emailVerified,
      },
      isNewUser,
    });
  } catch (error) {
    Logger.error("Error during Google login", error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

const updateRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "Guest") {
      return res.status(400).json({ message: "Role is already set" });
    }

    const allowedRoles = ["Student", "Instructor"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role selected" });
    }

    user.role = role;
    await user.save();

    const { password: _password, ...userData } = user.toJSON();
    Logger.info("User completed role selection", { userId: user.id, role });
    res
      .status(200)
      .json({ message: "Role updated successfully", user: userData });
  } catch (error) {
    Logger.error("Error updating user role", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export default {
  register,
  verifyEmail,
  login,
  googleLogin,
  refreshAccessToken,
  logout,
  addPassword,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
  resendVerificationEmail,
  updateRole,
};
