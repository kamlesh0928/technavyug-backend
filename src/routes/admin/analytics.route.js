import express from "express";
import analyticsController from "../../controllers/admin/analytics.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authenticate);
router.use(authorize("Super Admin", "Admin", "Sub Admin"));

router.get("/dashboard", analyticsController.getDashboardStats);
router.get("/revenue", analyticsController.getRevenueChart);
router.get("/enrollments", analyticsController.getEnrollmentChart);

export default router;
