import { Op } from "sequelize";
import {
  Course,
  Category,
  Section,
  Lecture,
  Enrollment,
  Review,
  User,
} from "../models/index.js";
import { getPagination, getPaginatedResponse } from "../utils/pagination.js";
import slugify from "../utils/slugify.js";
import Logger from "../utils/logger.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  cleanupFile,
} from "../middlewares/upload.middleware.js";

const createCourse = async (req, res) => {
  try {
    const {
      title,
      description,
      shortDescription,
      thumbnail,
      price,
      level,
      categoryId,
      language,
    } = req.body;

    let finalThumbnail = thumbnail;
    if (thumbnail && thumbnail.startsWith("data:image")) {
      try {
        const base64Data = thumbnail.split(",")[1];
        if (!base64Data) {
          throw new Error("Invalid base64 thumbnail data");
        }
        const buffer = Buffer.from(base64Data, "base64");
        const result = await uploadToCloudinary(buffer, "thumbnails", "image");
        finalThumbnail = result.url;
        Logger.info("Thumbnail uploaded to Cloudinary", {
          url: finalThumbnail,
        });
      } catch (uploadError) {
        Logger.error(
          "Failed to upload thumbnail to Cloudinary, using raw data instead",
          uploadError,
        );
      }
    }

    const course = await Course.create({
      title,
      slug: slugify(title),
      description,
      shortDescription,
      thumbnail: finalThumbnail,
      price: price || 0,
      level,
      categoryId: categoryId || null,
      language,
      instructorId: req.user.id,
    });

    Logger.info("Course created", { courseId: course.id });
    res
      .status(201)
      .json({ message: "Course created successfully", data: course });
  } catch (error) {
    Logger.error("Error creating course", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const listCourses = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const {
      status,
      level,
      categoryId,
      search,
      instructorId,
      minPrice,
      maxPrice,
    } = req.query;

    const where = {};
    if (status) where.status = status;
    if (level) where.level = level;
    if (categoryId) where.categoryId = categoryId;
    if (instructorId) where.instructorId = instructorId;
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }
    if (minPrice)
      where.price = { ...where.price, [Op.gte]: parseFloat(minPrice) };
    if (maxPrice)
      where.price = { ...where.price, [Op.lte]: parseFloat(maxPrice) };

    const { count, rows } = await Course.findAndCountAll({
      where,
      include: [
        { model: Category, attributes: ["id", "name", "slug"] },
        { model: User, as: "instructor", attributes: ["id", "name", "avatar"] },
      ],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    Logger.error("Error listing courses", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getCourseByIdOrSlug = async (req, res) => {
  try {
    const { identifier } = req.params;
    const where =
      identifier.length === 36 ? { id: identifier } : { slug: identifier };

    const course = await Course.findOne({
      where,
      include: [
        { model: Category, attributes: ["id", "name", "slug"] },
        {
          model: User,
          as: "instructor",
          attributes: ["id", "name", "avatar", "bio"],
        },
        {
          model: Section,
          as: "sections",
          order: [["order", "ASC"]],
          include: [
            {
              model: Lecture,
              as: "lectures",
              attributes: {
                exclude: req.user ? [] : ["videoUrl", "content", "resources"],
              },
              order: [["order", "ASC"]],
            },
          ],
        },
      ],
      order: [
        [{ model: Section, as: "sections" }, "order", "ASC"],
        [
          { model: Section, as: "sections" },
          { model: Lecture, as: "lectures" },
          "order",
          "ASC",
        ],
      ],
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.status(200).json({ data: course });
  } catch (error) {
    Logger.error("Error fetching course", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateCourse = async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Only the course instructor or an admin can update
    if (
      course.instructorId !== req.user.id &&
      req.user.role !== "Super Admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this course" });
    }

    const allowedFields = [
      "title",
      "description",
      "shortDescription",
      "thumbnail",
      "price",
      "level",
      "status",
      "categoryId",
      "language",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (
          field === "thumbnail" &&
          req.body.thumbnail &&
          req.body.thumbnail.startsWith("data:image")
        ) {
          const base64Data = req.body.thumbnail.split(",")[1];
          const buffer = Buffer.from(base64Data, "base64");
          const result = await uploadToCloudinary(
            buffer,
            "thumbnails",
            "image",
          );
          course.thumbnail = result.url;
        } else {
          course[field] = req.body[field];
        }
      }
    }

    if (req.body.title) {
      course.slug = slugify(req.body.title);
    }

    await course.save();

    Logger.info("Course updated", { courseId: course.id });
    res
      .status(200)
      .json({ message: "Course updated successfully", data: course });
  } catch (error) {
    Logger.error("Error updating course", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (
      course.instructorId !== req.user.id &&
      req.user.role !== "Super Admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this course" });
    }

    await course.destroy();
    Logger.info("Course deleted", { courseId: req.params.id });
    res.status(200).json({ message: "Course deleted successfully" });
  } catch (error) {
    Logger.error("Error deleting course", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// --- Section Management ---

const createSection = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title } = req.body;

    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (
      course.instructorId !== req.user.id &&
      req.user.role !== "Super Admin"
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const maxOrder = (await Section.max("order", { where: { courseId } })) || 0;

    const section = await Section.create({
      courseId,
      title,
      order: maxOrder + 1,
    });

    Logger.info("Section created", { sectionId: section.id });
    res
      .status(201)
      .json({ message: "Section created successfully", data: section });
  } catch (error) {
    Logger.error("Error creating section", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateSection = async (req, res) => {
  try {
    const section = await Section.findByPk(req.params.sectionId, {
      include: [{ model: Course }],
    });

    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    if (
      section.Course.instructorId !== req.user.id &&
      req.user.role !== "Super Admin"
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (req.body.title !== undefined) section.title = req.body.title;
    if (req.body.order !== undefined) section.order = req.body.order;

    await section.save();

    Logger.info("Section updated", { sectionId: section.id });
    res
      .status(200)
      .json({ message: "Section updated successfully", data: section });
  } catch (error) {
    Logger.error("Error updating section", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteSection = async (req, res) => {
  try {
    const section = await Section.findByPk(req.params.sectionId, {
      include: [{ model: Course }],
    });

    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    if (
      section.Course.instructorId !== req.user.id &&
      req.user.role !== "Super Admin"
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await section.destroy();
    Logger.info("Section deleted", { sectionId: req.params.sectionId });
    res.status(200).json({ message: "Section deleted successfully" });
  } catch (error) {
    Logger.error("Error deleting section", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const reorderSections = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { orderedIds } = req.body;

    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (
      course.instructorId !== req.user.id &&
      req.user.role !== "Super Admin"
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    for (let i = 0; i < orderedIds.length; i++) {
      await Section.update(
        { order: i + 1 },
        { where: { id: orderedIds[i], courseId } },
      );
    }

    res.status(200).json({ message: "Sections reordered successfully" });
  } catch (error) {
    Logger.error("Error reordering sections", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// --- Lecture Management ---

const createLecture = async (req, res) => {
  try {
    const { sectionId } = req.params;

    const section = await Section.findByPk(sectionId, {
      include: [{ model: Course }],
    });

    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    const course = section.Course;
    if (
      course.instructorId !== req.user.id &&
      req.user.role !== "Super Admin"
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const maxOrder =
      (await Lecture.max("order", { where: { sectionId } })) || 0;

    let videoUrl = req.body.videoUrl || null;
    let videoPublicId = null;
    let duration = req.body.duration ? parseInt(req.body.duration, 10) : 0;

    // If a video file was uploaded via multer, upload to Cloudinary
    if (req.file) {
      try {
        const result = await uploadToCloudinary(
          req.file.path,
          `courses/${section.courseId}/lectures`,
          "video",
        );
        videoUrl = result.url;
        videoPublicId = result.publicId;
        if (result.duration) duration = result.duration;
      } catch (uploadError) {
        // Always cleanup the local file on failure
        await cleanupFile(req.file.path);

        // Return a user-friendly error based on the Cloudinary error
        const httpCode = uploadError?.http_code || uploadError?.statusCode;
        if (httpCode === 413) {
          return res.status(413).json({
            message:
              "Video file is too large for upload. Please try a smaller or more compressed video.",
          });
        }
        if (
          uploadError?.message?.includes("timeout") ||
          uploadError?.code === "ETIMEDOUT"
        ) {
          return res.status(408).json({
            message:
              "Video upload timed out. Please check your internet connection and try again.",
          });
        }

        Logger.error("Error uploading video to Cloudinary", uploadError);
        return res.status(500).json({
          message: "Failed to upload video. Please try again later.",
        });
      } finally {
        // Always cleanup the local file
        await cleanupFile(req.file.path);
      }
    }

    // Handle boolean and JSON from FormData
    const isFree = req.body.isFree === "true" || req.body.isFree === true;
    let resources = req.body.resources || [];
    if (typeof resources === "string") {
      try {
        resources = JSON.parse(resources);
      } catch {
        resources = [];
      }
    }

    const lecture = await Lecture.create({
      sectionId,
      title: req.body.title,
      type: req.body.type || "Video",
      videoUrl,
      videoPublicId,
      duration,
      content: req.body.content,
      resources,
      order: maxOrder + 1,
      isFree,
    });

    // Update course aggregate counters safely
    // First, get all section IDs for this course
    const sections = await Section.findAll({
      where: { courseId: section.courseId },
      attributes: ["id"],
    });
    const sectionIds = sections.map((s) => s.id);

    const totalLectures = await Lecture.count({
      where: { sectionId: { [Op.in]: sectionIds } },
    });

    const totalDuration =
      (await Lecture.sum("duration", {
        where: { sectionId: { [Op.in]: sectionIds } },
      })) || 0;

    await Course.update(
      { totalLectures, totalDuration },
      { where: { id: section.courseId } },
    );

    Logger.info("Lecture created", { lectureId: lecture.id });
    res
      .status(201)
      .json({ message: "Lecture created successfully", data: lecture });
  } catch (error) {
    Logger.error("Error creating lecture", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getLecture = async (req, res) => {
  try {
    const lecture = await Lecture.findByPk(req.params.lectureId, {
      include: [{ model: Section, include: [{ model: Course }] }],
    });

    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    // If lecture is not free, check enrollment
    if (!lecture.isFree) {
      if (!req.user) {
        return res
          .status(401)
          .json({ message: "Authentication required to access this lecture" });
      }

      const courseId = lecture.Section.courseId;
      const isInstructor = lecture.Section.Course.instructorId === req.user.id;
      const isAdmin = ["Super Admin", "Admin", "Sub Admin"].includes(
        req.user.role,
      );

      if (!isInstructor && !isAdmin) {
        const enrollment = await Enrollment.findOne({
          where: { userId: req.user.id, courseId, status: "Active" },
        });

        if (!enrollment) {
          return res
            .status(403)
            .json({ message: "Enrollment required to access this lecture" });
        }
      }
    }

    res.status(200).json({ data: lecture });
  } catch (error) {
    Logger.error("Error fetching lecture", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateLecture = async (req, res) => {
  try {
    const lecture = await Lecture.findByPk(req.params.lectureId, {
      include: [{ model: Section, include: [{ model: Course }] }],
    });

    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    const course = lecture.Section.Course;
    if (
      course.instructorId !== req.user.id &&
      req.user.role !== "Super Admin"
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const allowedFields = [
      "title",
      "type",
      "videoUrl",
      "duration",
      "content",
      "resources",
      "order",
      "isFree",
    ];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        lecture[field] = req.body[field];
      }
    }

    await lecture.save();

    // Update course aggregates
    const totalDuration =
      (await Lecture.sum("duration", {
        include: [{ model: Section, where: { courseId: course.id } }],
      })) || 0;
    await Course.update({ totalDuration }, { where: { id: course.id } });

    Logger.info("Lecture updated", { lectureId: lecture.id });
    res
      .status(200)
      .json({ message: "Lecture updated successfully", data: lecture });
  } catch (error) {
    Logger.error("Error updating lecture", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteLecture = async (req, res) => {
  try {
    const lecture = await Lecture.findByPk(req.params.lectureId, {
      include: [{ model: Section, include: [{ model: Course }] }],
    });

    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    const course = lecture.Section.Course;
    if (
      course.instructorId !== req.user.id &&
      req.user.role !== "Super Admin"
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Delete video from Cloudinary if it was uploaded there
    if (lecture.videoPublicId) {
      await deleteFromCloudinary(lecture.videoPublicId, "video");
    }

    await lecture.destroy();

    // Update course aggregates
    const totalLectures = await Lecture.count({
      include: [{ model: Section, where: { courseId: course.id } }],
    });
    const totalDuration =
      (await Lecture.sum("duration", {
        include: [{ model: Section, where: { courseId: course.id } }],
      })) || 0;

    await Course.update(
      { totalLectures, totalDuration },
      { where: { id: course.id } },
    );

    Logger.info("Lecture deleted", { lectureId: req.params.lectureId });
    res.status(200).json({ message: "Lecture deleted successfully" });
  } catch (error) {
    Logger.error("Error deleting lecture", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export default {
  createCourse,
  listCourses,
  getCourseByIdOrSlug,
  updateCourse,
  deleteCourse,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
  createLecture,
  getLecture,
  updateLecture,
  deleteLecture,
};
