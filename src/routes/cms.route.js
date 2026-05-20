import express from "express";
import { body } from "express-validator";
import jwt from "jsonwebtoken";
import cmsController from "../controllers/cms.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { uploadImage } from "../middlewares/upload.middleware.js";
import { User } from "../models/index.js";

const router = express.Router();

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id, {
        attributes: { exclude: ["password"] },
      });
      if (user && user.status !== "Blocked") {
        req.user = user;
      }
    }
  } catch (err) {
    // Silently ignore auth errors - just continue as unauthenticated
  }
  next();
};

// Blogs
// Public with optional authentication - authenticated admins see all blogs, others see only published
router.get("/blogs", optionalAuth, cmsController.listBlogs);
router.get("/blogs/:identifier", cmsController.getBlogByIdOrSlug);

// Admin only
router.post(
  "/blogs",
  authenticate,
  authorize("Super Admin", "Admin", "Sub Admin"),
  body("title").notEmpty().withMessage("Title is required"),
  body("content").notEmpty().withMessage("Content is required"),
  validate,
  cmsController.createBlog,
);

router.put(
  "/blogs/:id",
  authenticate,
  authorize("Super Admin", "Admin", "Sub Admin"),
  cmsController.updateBlog,
);

router.delete(
  "/blogs/:id",
  authenticate,
  authorize("Super Admin", "Admin", "Sub Admin"),
  cmsController.deleteBlog,
);

// Blog Image Upload
router.post(
  "/blogs/upload-image",
  authenticate,
  authorize("Super Admin", "Admin", "Sub Admin"),
  uploadImage,
  cmsController.uploadBlogImage,
);

// FAQs
// Public
router.get("/faqs", cmsController.listFaqs);

// Admin only
router.post(
  "/faqs",
  authenticate,
  authorize("Super Admin", "Admin", "Sub Admin"),
  body("question").notEmpty().withMessage("Question is required"),
  body("answer").notEmpty().withMessage("Answer is required"),
  validate,
  cmsController.createFaq,
);

router.put(
  "/faqs/:id",
  authenticate,
  authorize("Super Admin", "Admin", "Sub Admin"),
  cmsController.updateFaq,
);

router.delete(
  "/faqs/:id",
  authenticate,
  authorize("Super Admin", "Admin", "Sub Admin"),
  cmsController.deleteFaq,
);

export default router;
