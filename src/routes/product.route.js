import express from "express";
import { body } from "express-validator";
import productController from "../controllers/product.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { uploadImage } from "../middlewares/upload.middleware.js";

const router = express.Router();

// Public
router.get("/", productController.listProducts);
router.get("/:identifier", productController.getProductById);

// Admin only
router.post(
  "/upload-image",
  authenticate,
  authorize("Super Admin", "Admin", "Sub Admin"),
  uploadImage,
  productController.uploadProductImage,
);

router.post(
  "/",
  authenticate,
  authorize("Super Admin", "Admin", "Sub Admin"),
  body("name").notEmpty().withMessage("Product name is required"),
  body("price").isDecimal().withMessage("Price must be a valid number"),
  validate,
  productController.createProduct,
);

router.put(
  "/:id",
  authenticate,
  authorize("Super Admin", "Admin", "Sub Admin"),
  productController.updateProduct,
);

router.delete(
  "/:id",
  authenticate,
  authorize("Super Admin", "Admin", "Sub Admin"),
  productController.deleteProduct,
);

export default router;
