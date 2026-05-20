import express from "express";
import { body } from "express-validator";

import authController from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";

const router = express.Router();

router.post(
  "/register",
  body("name").notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Provide a valid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  validate,
  authController.register,
);

router.post("/resend-verification", authController.resendVerificationEmail);

router.post("/verify-email", authController.verifyEmail);

router.post(
  "/login",
  body("email").isEmail().withMessage("Provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
  validate,
  authController.login,
);

router.post("/google", authController.googleLogin);

router.post("/refresh-token", authController.refreshAccessToken);
router.post("/logout", authController.logout);

router.post(
  "/forgot-password",
  body("email").isEmail().withMessage("Provide a valid email"),
  validate,
  authController.forgotPassword,
);

router.post(
  "/reset-password",
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  validate,
  authController.resetPassword,
);

// Protected routes
router.get("/me", authenticate, authController.getMe);

router.post(
  "/add-password",
  authenticate,
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  validate,
  authController.addPassword,
);

router.post(
  "/update-role",
  authenticate,
  body("role").isIn(["Student", "Instructor"]).withMessage("Invalid role"),
  validate,
  authController.updateRole
);

router.put(
  "/profile",
  authenticate,
  body("name").optional().notEmpty().withMessage("Name cannot be empty"),
  body("phone").optional().isMobilePhone().withMessage("Invalid phone number"),
  validate,
  authController.updateProfile,
);

router.put(
  "/change-password",
  authenticate,
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters"),
  validate,
  authController.changePassword,
);

router.delete(
  "/account",
  authenticate,
  body("password")
    .notEmpty()
    .withMessage("Password is required to delete account"),
  validate,
  authController.deleteAccount,
);

export default router;
