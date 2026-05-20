import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";
import path from "path";
import { promisify } from "util";

import Logger from "../utils/logger.js";

const unlinkAsync = promisify(fs.unlink);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "src/tmp/uploads";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const videoFileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["video/mp4", "video/webm", "video/quicktime"];
  const allowedExtensions = [".mp4", ".webm", ".mov"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (
    allowedMimeTypes.includes(file.mimetype) ||
    allowedExtensions.includes(ext)
  ) {
    cb(null, true);
  } else {
    cb(
      new Error("Invalid file type. Only MP4, WebM, and MOV are allowed."),
      false,
    );
  }
};

const imageFileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, WebP, GIF, and SVG are allowed.",
      ),
      false,
    );
  }
};

export const uploadVideo = multer({
  storage,
  fileFilter: videoFileFilter,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
}).single("video");

export const uploadImage = multer({
  storage: multer.memoryStorage(), // Images are small, memory storage is fine
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
}).single("image");

/**
 * Upload a file/buffer to Cloudinary.
 * @param {string|Buffer} source - Local file path or Buffer from multer
 * @param {string} folder - Cloudinary folder name
 * @param {string} resourceType - "video" or "image"
 * @returns {Promise<{url: string, publicId: string, duration?: number}>}
 */
export const uploadToCloudinary = (source, folder, resourceType = "video") => {
  return new Promise((resolve, reject) => {
    // If it's a buffer (old way), use upload_stream
    if (Buffer.isBuffer(source)) {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: resourceType,
          folder: `technavyug/${folder}`,
          chunk_size: 6_000_000,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            duration: result.duration ? Math.round(result.duration) : 0,
          });
        },
      );
      stream.end(source);
    } else {
      // It's a file path (new way), use uploader.upload which is better for large files
      cloudinary.uploader.upload(
        source,
        {
          resource_type: resourceType,
          folder: `technavyug/${folder}`,
          chunk_size: 20_000_000, // 20MB chunks for better performance on large videos
        },
        async (error, result) => {
          if (error) return reject(error);
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            duration: result.duration ? Math.round(result.duration) : 0,
          });
        },
      );
    }
  });
};

/**
 * Delete a resource from Cloudinary by public_id.
 * @param {string} publicId
 * @param {string} resourceType - "video" or "image"
 */
export const deleteFromCloudinary = async (
  publicId,
  resourceType = "video",
) => {
  if (!publicId) return;
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
  });
};

/**
 * Helper to cleanup local files
 * @param {string} filePath
 */
export const cleanupFile = async (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      await unlinkAsync(filePath);
    }
  } catch (error) {
    Logger.error(`Cleanup failed for ${filePath}:`, error);
  }
};

/**
 * Middleware to handle multer errors gracefully.
 * Place this AFTER the multer middleware in the route chain.
 */
export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: "File is too large. Please upload a smaller file.",
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        message: "Unexpected file field. Please check your upload.",
      });
    }
    return res.status(400).json({
      message: `Upload error: ${err.message}`,
    });
  }

  if (err) {
    // Custom errors from file filter callbacks
    if (err.message && err.message.includes("Invalid file type")) {
      return res.status(400).json({ message: err.message });
    }
    // Pass other errors to the next error handler
    return next(err);
  }

  next();
};
