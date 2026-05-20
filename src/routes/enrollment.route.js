import express from "express";
import enrollmentController from "../controllers/enrollment.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

// Student routes
router.post("/courses/:courseId", enrollmentController.enrollInCourse);
router.get("/my", enrollmentController.getMyEnrollments);
router.get("/status/:courseId", enrollmentController.getEnrollmentStatus);
router.patch("/cancel/:courseId", enrollmentController.cancelEnrollment);

// Progress tracking
router.post(
  "/progress/:lectureId/complete",
  enrollmentController.markLectureComplete,
);
router.get("/progress/:courseId", enrollmentController.getCourseProgress);

// Admin: view enrollments for a course
router.get(
  "/courses/:courseId/list",
  authorize("Super Admin", "Admin", "Sub Admin", "Instructor"),
  enrollmentController.getCourseEnrollments,
);

export default router;
