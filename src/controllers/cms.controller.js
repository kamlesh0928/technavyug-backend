import { Op } from "sequelize";
import { Blog, Faq, User } from "../models/index.js";
import { getPagination, getPaginatedResponse } from "../utils/pagination.js";
import slugify from "../utils/slugify.js";
import Logger from "../utils/logger.js";
import { uploadToCloudinary } from "../middlewares/upload.middleware.js";

const createBlog = async (req, res) => {
  try {
    const { title, content, excerpt, coverImage, status, tags } = req.body;

    const blog = await Blog.create({
      title,
      slug: slugify(title),
      content,
      excerpt,
      coverImage,
      authorId: req.user.id,
      status: status || "Draft",
      tags: tags || [],
      publishedAt: status === "Published" ? new Date() : null,
    });

    Logger.info("Blog created", { blogId: blog.id });
    res.status(201).json({ message: "Blog created successfully", data: blog });
  } catch (error) {
    Logger.error("Error creating blog", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const listBlogs = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, search, tag } = req.query;

    const where = {};

    // Admin (authenticated) sees all blogs. Public (unauthenticated) sees only published
    if (status) {
      where.status = status;
    } else if (
      !req.user ||
      !["Super Admin", "Admin", "Sub Admin"].includes(req.user.role)
    ) {
      where.status = "Published";
    }

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { content: { [Op.like]: `%${search}%` } },
      ];
    }

    Logger.info("Fetching blogs", {
      user: req.user ? `${req.user.name} (${req.user.role})` : "Anonymous",
      status: where.status || "all",
      page,
      limit,
    });

    const { count, rows } = await Blog.findAndCountAll({
      where,
      include: [
        { model: User, as: "author", attributes: ["id", "name", "avatar"] },
      ],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    Logger.info("Blogs fetched successfully", {
      totalCount: count,
      returnedCount: rows.length,
    });

    res.status(200).json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    Logger.error("Error listing blogs", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getBlogByIdOrSlug = async (req, res) => {
  try {
    const { identifier } = req.params;
    const where =
      identifier.length === 36 ? { id: identifier } : { slug: identifier };

    const blog = await Blog.findOne({
      where,
      include: [
        {
          model: User,
          as: "author",
          attributes: ["id", "name", "avatar", "bio"],
        },
      ],
    });

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    res.status(200).json({ data: blog });
  } catch (error) {
    Logger.error("Error fetching blog", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateBlog = async (req, res) => {
  try {
    const blog = await Blog.findByPk(req.params.id);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    const fields = [
      "title",
      "content",
      "excerpt",
      "coverImage",
      "status",
      "tags",
    ];
    for (const field of fields) {
      if (req.body[field] !== undefined) blog[field] = req.body[field];
    }

    if (req.body.title) blog.slug = slugify(req.body.title);
    if (req.body.status === "Published" && !blog.publishedAt) {
      blog.publishedAt = new Date();
    }

    await blog.save();
    Logger.info("Blog updated", { blogId: blog.id });
    res.status(200).json({ message: "Blog updated successfully", data: blog });
  } catch (error) {
    Logger.error("Error updating blog", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findByPk(req.params.id);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    await blog.destroy();
    Logger.info("Blog deleted", { blogId: req.params.id });
    res.status(200).json({ message: "Blog deleted successfully" });
  } catch (error) {
    Logger.error("Error deleting blog", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const createFaq = async (req, res) => {
  try {
    const faq = await Faq.create(req.body);
    Logger.info("FAQ created", { faqId: faq.id });
    res.status(201).json({ message: "FAQ created successfully", data: faq });
  } catch (error) {
    Logger.error("Error creating FAQ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const listFaqs = async (req, res) => {
  try {
    const { category } = req.query;
    const where = { isActive: true };
    if (category) where.category = category;

    const faqs = await Faq.findAll({
      where,
      order: [["order", "ASC"]],
    });

    res.status(200).json({ data: faqs });
  } catch (error) {
    Logger.error("Error listing FAQs", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateFaq = async (req, res) => {
  try {
    const faq = await Faq.findByPk(req.params.id);
    if (!faq) {
      return res.status(404).json({ message: "FAQ not found" });
    }

    const fields = ["question", "answer", "category", "order", "isActive"];
    for (const field of fields) {
      if (req.body[field] !== undefined) faq[field] = req.body[field];
    }

    await faq.save();
    Logger.info("FAQ updated", { faqId: faq.id });
    res.status(200).json({ message: "FAQ updated successfully", data: faq });
  } catch (error) {
    Logger.error("Error updating FAQ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteFaq = async (req, res) => {
  try {
    const faq = await Faq.findByPk(req.params.id);
    if (!faq) {
      return res.status(404).json({ message: "FAQ not found" });
    }

    await faq.destroy();
    Logger.info("FAQ deleted", { faqId: req.params.id });
    res.status(200).json({ message: "FAQ deleted successfully" });
  } catch (error) {
    Logger.error("Error deleting FAQ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const uploadBlogImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const { url } = await uploadToCloudinary(
      req.file.buffer,
      "blog-images",
      "image",
    );

    Logger.info("Blog image uploaded", { fileName: req.file.originalname });
    res.status(200).json({
      message: "Image uploaded successfully",
      data: { url },
    });
  } catch (error) {
    Logger.error("Error uploading blog image", error);
    res.status(500).json({ message: "Failed to upload image" });
  }
};

export default {
  createBlog,
  listBlogs,
  getBlogByIdOrSlug,
  updateBlog,
  deleteBlog,
  createFaq,
  listFaqs,
  updateFaq,
  deleteFaq,
  uploadBlogImage,
};
