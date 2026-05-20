import express from "express";
import { body } from "express-validator";
import courseController from "../controllers/course.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  uploadVideo,
  handleMulterError,
} from "../middlewares/upload.middleware.js";

const router = express.Router();

// Public routes
router.get("/", courseController.listCourses);
router.get("/:identifier", courseController.getCourseByIdOrSlug);

// Instructor and Admin routes
router.post(
  "/",
  authenticate,
  authorize("Super Admin", "Instructor"),
  body("title").notEmpty().withMessage("Title is required"),
  body("price")
    .optional()
    .isDecimal()
    .withMessage("Price must be a valid number"),
  validate,
  courseController.createCourse,
);

router.put(
  "/:id",
  authenticate,
  authorize("Super Admin", "Instructor"),
  courseController.updateCourse,
);

router.delete(
  "/:id",
  authenticate,
  authorize("Super Admin", "Instructor"),
  courseController.deleteCourse,
);

// Section routes
router.post(
  "/:courseId/sections",
  authenticate,
  authorize("Super Admin", "Instructor"),
  body("title").notEmpty().withMessage("Section title is required"),
  validate,
  courseController.createSection,
);

router.put(
  "/sections/:sectionId",
  authenticate,
  authorize("Super Admin", "Instructor"),
  courseController.updateSection,
);

router.delete(
  "/sections/:sectionId",
  authenticate,
  authorize("Super Admin", "Instructor"),
  courseController.deleteSection,
);

router.put(
  "/:courseId/sections/reorder",
  authenticate,
  authorize("Super Admin", "Instructor"),
  body("orderedIds").isArray().withMessage("orderedIds must be an array"),
  validate,
  courseController.reorderSections,
);

// Lecture routes (supports multipart/form-data video upload)
router.post(
  "/sections/:sectionId/lectures",
  authenticate,
  authorize("Super Admin", "Instructor"),
  uploadVideo,
  handleMulterError,
  body("title").notEmpty().withMessage("Lecture title is required"),
  validate,
  courseController.createLecture,
);

router.get("/lectures/:lectureId", authenticate, courseController.getLecture);

router.put(
  "/lectures/:lectureId",
  authenticate,
  authorize("Super Admin", "Instructor"),
  courseController.updateLecture,
);

router.delete(
  "/lectures/:lectureId",
  authenticate,
  authorize("Super Admin", "Instructor"),
  courseController.deleteLecture,
);

export default router;
