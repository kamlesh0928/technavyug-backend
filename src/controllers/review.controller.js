import { Op } from "sequelize";
import { Review, Course, User, Enrollment } from "../models/index.js";
import { getPagination, getPaginatedResponse } from "../utils/pagination.js";
import Logger from "../utils/logger.js";

const createReview = async (req, res) => {
  try {
    const { courseId, rating, comment } = req.body;

    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Verify enrollment
    const enrollment = await Enrollment.findOne({
      where: { userId: req.user.id, courseId },
    });

    if (!enrollment) {
      return res
        .status(403)
        .json({ message: "You must be enrolled to review this course" });
    }

    // Check for existing review
    const existing = await Review.findOne({
      where: { userId: req.user.id, courseId },
    });

    if (existing) {
      return res
        .status(400)
        .json({ message: "You have already reviewed this course" });
    }

    const review = await Review.create({
      userId: req.user.id,
      courseId,
      rating,
      comment,
    });

    // Update course average rating
    const stats = await Review.findOne({
      where: { courseId },
      attributes: [
        [
          Review.sequelize.fn("AVG", Review.sequelize.col("rating")),
          "avgRating",
        ],
        [
          Review.sequelize.fn("COUNT", Review.sequelize.col("id")),
          "totalReviews",
        ],
      ],
      raw: true,
    });

    await Course.update(
      {
        averageRating: parseFloat(stats.avgRating).toFixed(2),
        totalReviews: parseInt(stats.totalReviews, 10),
      },
      { where: { id: courseId } },
    );

    Logger.info("Review created", { reviewId: review.id, courseId });
    res
      .status(201)
      .json({ message: "Review submitted successfully", data: review });
  } catch (error) {
    Logger.error("Error creating review", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getCourseReviews = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { page, limit, offset } = getPagination(req.query);
    const { rating } = req.query;

    const where = { courseId };
    if (rating) where.rating = parseInt(rating, 10);

    const { count, rows } = await Review.findAndCountAll({
      where,
      include: [{ model: User, attributes: ["id", "name", "avatar"] }],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    Logger.error("Error fetching reviews", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateReview = async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.userId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this review" });
    }

    if (req.body.rating !== undefined) review.rating = req.body.rating;
    if (req.body.comment !== undefined) review.comment = req.body.comment;

    await review.save();

    // Recalculate average
    const stats = await Review.findOne({
      where: { courseId: review.courseId },
      attributes: [
        [
          Review.sequelize.fn("AVG", Review.sequelize.col("rating")),
          "avgRating",
        ],
      ],
      raw: true,
    });

    await Course.update(
      { averageRating: parseFloat(stats.avgRating).toFixed(2) },
      { where: { id: review.courseId } },
    );

    Logger.info("Review updated", { reviewId: review.id });
    res
      .status(200)
      .json({ message: "Review updated successfully", data: review });
  } catch (error) {
    Logger.error("Error updating review", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteReview = async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Owner or admin can delete
    if (
      review.userId !== req.user.id &&
      !["Super Admin", "Admin", "Sub Admin"].includes(req.user.role)
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this review" });
    }

    const courseId = review.courseId;
    await review.destroy();

    // Recalculate average
    const stats = await Review.findOne({
      where: { courseId },
      attributes: [
        [
          Review.sequelize.fn("AVG", Review.sequelize.col("rating")),
          "avgRating",
        ],
        [
          Review.sequelize.fn("COUNT", Review.sequelize.col("id")),
          "totalReviews",
        ],
      ],
      raw: true,
    });

    await Course.update(
      {
        averageRating: stats.avgRating
          ? parseFloat(stats.avgRating).toFixed(2)
          : 0,
        totalReviews: parseInt(stats.totalReviews, 10) || 0,
      },
      { where: { id: courseId } },
    );

    Logger.info("Review deleted", { reviewId: req.params.id });
    res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    Logger.error("Error deleting review", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export default {
  createReview,
  getCourseReviews,
  updateReview,
  deleteReview,
};
