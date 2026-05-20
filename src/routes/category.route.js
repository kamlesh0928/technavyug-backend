import express from "express";
import { body } from "express-validator";
import categoryController from "../controllers/category.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";

const router = express.Router();

// Public
router.get("/", categoryController.listCategories);
router.get("/:id", categoryController.getCategoryById);

// Admin only
router.post(
  "/",
  authenticate,
  authorize("Super Admin", "Admin", "Sub Admin", "Instructor"),
  body("name").notEmpty().withMessage("Category name is required"),
  validate,
  categoryController.createCategory,
);

router.put(
  "/:id",
  authenticate,
  authorize("Super Admin", "Admin", "Sub Admin"),
  categoryController.updateCategory,
);

router.delete(
  "/:id",
  authenticate,
  authorize("Super Admin", "Admin", "Sub Admin"),
  categoryController.deleteCategory,
);

export default router;
