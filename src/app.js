import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

// Route imports
import authRoutes from "./routes/auth.route.js";
import adminUserRoutes from "./routes/admin/user.route.js";
import adminAnalyticsRoutes from "./routes/admin/analytics.route.js";
import categoryRoutes from "./routes/category.route.js";
import courseRoutes from "./routes/course.route.js";
import enrollmentRoutes from "./routes/enrollment.route.js";
import productRoutes from "./routes/product.route.js";
import orderRoutes from "./routes/order.route.js";
import paymentRoutes from "./routes/payment.route.js";
import reviewRoutes from "./routes/review.route.js";
import cmsRoutes from "./routes/cms.route.js";
import notificationRoutes from "./routes/notification.route.js";
import ticketRoutes from "./routes/ticket.route.js";
import contactRoutes from "./routes/contact.route.js";
import studentRoutes from "./routes/student.route.js";
import phonepePaymentRoutes from "./routes/phonepePayment.route.js";
import addressRoutes from "./routes/address.route.js";
import couponRoutes from "./routes/coupon.route.js";

import Logger from "./utils/logger.js";

const app = express();

// Trust proxy for rate-limiter when behind a reverse proxy
app.set("trust proxy", 1);

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: false,
  }),
);

// CORS configuration
app.use(
  cors({
    origin: [process.env.FRONTEND_URL_1, process.env.FRONTEND_URL_2]
      .filter(Boolean)
      .map((url) => url.trim()),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" },
});
app.use(limiter);

// Body and Cookie Parsing
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// Server health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin/users", adminUserRoutes);
app.use("/api/v1/admin/analytics", adminAnalyticsRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/courses", courseRoutes);
app.use("/api/v1/enrollments", enrollmentRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/cms", cmsRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/tickets", ticketRoutes);
app.use("/api/v1/contact", contactRoutes);
app.use("/api/v1/student", studentRoutes);
app.use("/api/v1/phonepe", phonepePaymentRoutes);
app.use("/api/v1/addresses", addressRoutes);
app.use("/api/v1/coupons", couponRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

// Global error handler
app.use((err, req, res, _next) => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.isOperational ? err.message : "Internal Server Error";

  if (process.env.NODE_ENV !== "production") {
    Logger.error(err);
  }

  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

export default app;
