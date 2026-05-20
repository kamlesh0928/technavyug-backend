import {
  Enrollment,
  Course,
  LectureProgress,
  Section,
  Lecture,
  User,
  Category,
  MonthlyGoal,
} from "../models/index.js";
import { getPagination, getPaginatedResponse } from "../utils/pagination.js";
import Logger from "../utils/logger.js";
import sendEmail from "../services/email.service.js";
import enrollmentSuccessTemplate from "../templates/email/enrollmentSuccess.template.js";

const enrollInCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (course.status !== "Published") {
      return res
        .status(400)
        .json({ message: "Course is not available for enrollment" });
    }

    // Check if the course is free
    if (parseFloat(course.price) > 0) {
      return res.status(400).json({
        message:
          "This is a paid course. Please complete the purchase to enroll.",
      });
    }

    const existing = await Enrollment.findOne({
      where: { userId: req.user.id, courseId },
    });

    if (existing) {
      if (existing.status === "Active" || existing.status === "Completed") {
        return res
          .status(400)
          .json({ message: "Already enrolled in this course" });
      }
      // Re-activate cancelled enrollment
      existing.status = "Active";
      existing.enrolledAt = new Date();
      await existing.save();

      return res.status(200).json({
        message: "Re-enrolled in course successfully",
        data: existing,
      });
    }

    const enrollment = await Enrollment.create({
      userId: req.user.id,
      courseId,
    });

    // Increment enrollment counter
    await Course.increment("totalEnrollments", { where: { id: courseId } });

    Logger.info("User enrolled in course", {
      userId: req.user.id,
      courseId,
    });

    res
      .status(201)
      .json({ message: "Enrolled successfully", data: enrollment });

    // Send confirmation email asynchronously
    (async () => {
      try {
        const user = await User.findByPk(req.user.id);
        const frontendUrl =
          process.env.FRONTEND_URL_1 || process.env.FRONTEND_URL_2;
        const myLearningUrl = `${frontendUrl}/student/courses`;

        await sendEmail(
          user.email,
          `Successfully Enrolled: ${course.title}`,
          enrollmentSuccessTemplate(user.name, course.title, myLearningUrl),
        );
      } catch (emailError) {
        Logger.error(
          "Failed to send enrollment confirmation email",
          emailError,
        );
      }
    })();
  } catch (error) {
    Logger.error("Error enrolling in course", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getMyEnrollments = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status } = req.query;

    const where = { userId: req.user.id };
    if (status) where.status = status;

    const { count, rows } = await Enrollment.findAndCountAll({
      where,
      include: [
        {
          model: Course,
          include: [
            { model: Category, attributes: ["id", "name"] },
            {
              model: User,
              as: "instructor",
              attributes: ["id", "name", "avatar"],
            },
          ],
        },
      ],
      limit,
      offset,
      order: [["enrolledAt", "DESC"]],
    });

    res.status(200).json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    Logger.error("Error fetching enrollments", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getEnrollmentStatus = async (req, res) => {
  try {
    const { courseId } = req.params;

    const enrollment = await Enrollment.findOne({
      where: { userId: req.user.id, courseId },
    });

    if (!enrollment) {
      return res.status(200).json({ enrolled: false });
    }

    res.status(200).json({ enrolled: true, data: enrollment });
  } catch (error) {
    Logger.error("Error checking enrollment status", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const cancelEnrollment = async (req, res) => {
  try {
    const { courseId } = req.params;

    const enrollment = await Enrollment.findOne({
      where: { userId: req.user.id, courseId, status: "Active" },
    });

    if (!enrollment) {
      return res.status(404).json({ message: "Active enrollment not found" });
    }

    enrollment.status = "Cancelled";
    await enrollment.save();

    Logger.info("Enrollment cancelled", { userId: req.user.id, courseId });
    res.status(200).json({ message: "Enrollment cancelled successfully" });
  } catch (error) {
    Logger.error("Error cancelling enrollment", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// --- Progress Tracking ---

const markLectureComplete = async (req, res) => {
  try {
    const { lectureId } = req.params;

    const lecture = await Lecture.findByPk(lectureId, {
      include: [{ model: Section }],
    });

    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    const courseId = lecture.Section.courseId;

    const enrollment = await Enrollment.findOne({
      where: { userId: req.user.id, courseId, status: "Active" },
    });

    if (!enrollment) {
      return res.status(403).json({ message: "Not enrolled in this course" });
    }

    const [progress, created] = await LectureProgress.findOrCreate({
      where: { userId: req.user.id, lectureId },
      defaults: { completed: true, completedAt: new Date() },
    });

    if (!created && !progress.completed) {
      progress.completed = true;
      progress.completedAt = new Date();
      await progress.save();
    }

    // Calculate course completion percentage safely
    // 1. Get all lecture IDs for this exact course
    const courseLectures = await Lecture.findAll({
      attributes: ["id"],
      include: [{ model: Section, where: { courseId }, attributes: [] }],
      raw: true,
    });

    const lectureIds = courseLectures.map((l) => l.id);
    const totalLectures = lectureIds.length;

    // 2. Count ONLY progress records matching those exact lecture IDs
    const completedLectures = await LectureProgress.count({
      where: {
        userId: req.user.id,
        completed: true,
        lectureId: lectureIds,
      },
    });

    const completionPercent =
      totalLectures > 0
        ? Math.round((completedLectures / totalLectures) * 10000) / 100
        : 0;

    enrollment.progress = completionPercent;
    if (completionPercent >= 100) {
      enrollment.status = "Completed";
      enrollment.completedAt = new Date();
    }
    await enrollment.save();

    // --- Streak tracking (IST, day boundary at 6 AM) ---
    try {
      const user = await User.findByPk(req.user.id);
      if (user) {
        // Get current IST date with 6 AM boundary
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
        const istNow = new Date(now.getTime() + istOffset);
        // Subtract 6 hours so the "day" starts at 6 AM IST
        const adjusted = new Date(istNow.getTime() - 6 * 60 * 60 * 1000);
        const todayStr = adjusted.toISOString().split("T")[0];

        const lastStudy = user.lastStudyDate;

        if (lastStudy !== todayStr) {
          if (lastStudy) {
            // Calculate yesterday in same 6AM-boundary terms
            const adjustedYesterday = new Date(adjusted);
            adjustedYesterday.setDate(adjustedYesterday.getDate() - 1);
            const yesterdayStr = adjustedYesterday.toISOString().split("T")[0];

            if (lastStudy === yesterdayStr) {
              user.currentStreak += 1;
            } else {
              user.currentStreak = 1;
            }
          } else {
            user.currentStreak = 1;
          }

          if (user.currentStreak > user.longestStreak) {
            user.longestStreak = user.currentStreak;
          }
          user.lastStudyDate = todayStr;
          await user.save();
        }

        // --- Monthly goal progress ---
        const currentMonth = istNow.getMonth() + 1;
        const currentYear = istNow.getFullYear();
        const activeGoal = await MonthlyGoal.findOne({
          where: {
            userId: req.user.id,
            month: currentMonth,
            year: currentYear,
            status: "Active",
          },
        });
        if (activeGoal) {
          activeGoal.completedLectures += 1;
          if (activeGoal.completedLectures >= activeGoal.targetLectures) {
            activeGoal.status = "Completed";
          }
          await activeGoal.save();
        }
      }
    } catch (streakError) {
      Logger.error("Error updating streak/goal", streakError);
    }

    res.status(200).json({
      message: "Lecture marked as complete",
      data: {
        lectureId,
        completedLectures,
        totalLectures,
        courseProgress: completionPercent,
      },
    });
  } catch (error) {
    Logger.error("Error marking lecture complete", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;

    const enrollment = await Enrollment.findOne({
      where: { userId: req.user.id, courseId },
    });

    if (!enrollment) {
      return res.status(404).json({ message: "Not enrolled in this course" });
    }

    const sections = await Section.findAll({
      where: { courseId },
      include: [
        {
          model: Lecture,
          as: "lectures",
          include: [
            {
              model: LectureProgress,
              where: { userId: req.user.id },
              required: false,
            },
          ],
        },
      ],
      order: [
        ["order", "ASC"],
        [{ model: Lecture, as: "lectures" }, "order", "ASC"],
      ],
    });

    const progressData = sections.map((section) => ({
      sectionId: section.id,
      title: section.title,
      lectures: section.lectures.map((lecture) => ({
        lectureId: lecture.id,
        title: lecture.title,
        type: lecture.type,
        videoUrl: lecture.videoUrl,
        content: lecture.content,
        duration: lecture.duration,
        completed: lecture.LectureProgresses?.[0]?.completed || false,
        completedAt: lecture.LectureProgresses?.[0]?.completedAt || null,
      })),
    }));

    res.status(200).json({
      data: {
        courseId,
        enrollmentStatus: enrollment.status,
        overallProgress: enrollment.progress,
        sections: progressData,
      },
    });
  } catch (error) {
    Logger.error("Error fetching course progress", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Admin: list enrollments for a course
const getCourseEnrollments = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { page, limit, offset } = getPagination(req.query);

    const { count, rows } = await Enrollment.findAndCountAll({
      where: { courseId },
      include: [{ model: User, attributes: ["id", "name", "email", "avatar"] }],
      limit,
      offset,
      order: [["enrolledAt", "DESC"]],
    });

    res.status(200).json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    Logger.error("Error fetching course enrollments", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export default {
  enrollInCourse,
  getMyEnrollments,
  getEnrollmentStatus,
  cancelEnrollment,
  markLectureComplete,
  getCourseProgress,
  getCourseEnrollments,
};
