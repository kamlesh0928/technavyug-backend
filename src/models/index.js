import sequelize from "../config/db.js";
import User from "./user.model.js";
import RefreshToken from "./refreshToken.js";
import VerificationToken from "./verificationToken.js";
import Category from "./category.model.js";
import Course from "./course.model.js";
import Section from "./section.model.js";
import Lecture from "./lecture.model.js";
import Enrollment from "./enrollment.model.js";
import LectureProgress from "./lectureProgress.model.js";
import Product from "./product.model.js";
import Order from "./order.model.js";
import OrderItem from "./orderItem.model.js";
import Payment from "./payment.model.js";
import Review from "./review.model.js";
import HomepageContent from "./homepageContent.model.js";
import Blog from "./blog.model.js";
import Faq from "./faq.model.js";
import Notification from "./notification.model.js";
import Ticket from "./ticket.model.js";
import TicketReply from "./ticketReply.model.js";
import MonthlyGoal from "./monthlyGoal.model.js";
import Transaction from "./transaction.model.js";
import Address from "./address.model.js";
import Coupon from "./coupon.model.js";
import CouponUsage from "./couponUsage.model.js";
import InvoiceCounter from "./invoiceCounter.model.js";
import OrderCounter from "./orderCounter.model.js";

// Auth Relationships
User.hasMany(RefreshToken, { foreignKey: "userId", onDelete: "CASCADE" });
RefreshToken.belongsTo(User, { foreignKey: "userId" });

User.hasMany(VerificationToken, { foreignKey: "userId", onDelete: "CASCADE" });
VerificationToken.belongsTo(User, { foreignKey: "userId" });

// Course Relationships
Category.hasMany(Course, { foreignKey: "categoryId", onDelete: "SET NULL" });
Course.belongsTo(Category, { foreignKey: "categoryId" });

User.hasMany(Course, {
  foreignKey: "instructorId",
  as: "courses",
  onDelete: "CASCADE",
});
Course.belongsTo(User, { foreignKey: "instructorId", as: "instructor" });

Course.hasMany(Section, {
  foreignKey: "courseId",
  as: "sections",
  onDelete: "CASCADE",
});
Section.belongsTo(Course, { foreignKey: "courseId" });

Section.hasMany(Lecture, {
  foreignKey: "sectionId",
  as: "lectures",
  onDelete: "CASCADE",
});
Lecture.belongsTo(Section, { foreignKey: "sectionId" });

// Enrollment Relationships
User.hasMany(Enrollment, { foreignKey: "userId", onDelete: "CASCADE" });
Enrollment.belongsTo(User, { foreignKey: "userId" });

Course.hasMany(Enrollment, { foreignKey: "courseId", onDelete: "CASCADE" });
Enrollment.belongsTo(Course, { foreignKey: "courseId" });

User.hasMany(LectureProgress, { foreignKey: "userId", onDelete: "CASCADE" });
LectureProgress.belongsTo(User, { foreignKey: "userId" });

Lecture.hasMany(LectureProgress, {
  foreignKey: "lectureId",
  onDelete: "CASCADE",
});
LectureProgress.belongsTo(Lecture, { foreignKey: "lectureId" });

// E-Commerce Relationships
User.hasMany(Order, { foreignKey: "userId", onDelete: "CASCADE" });
Order.belongsTo(User, { foreignKey: "userId" });

Order.hasMany(OrderItem, {
  foreignKey: "orderId",
  as: "items",
  onDelete: "CASCADE",
});
OrderItem.belongsTo(Order, { foreignKey: "orderId" });

Product.hasMany(OrderItem, { foreignKey: "productId", onDelete: "RESTRICT" });
OrderItem.belongsTo(Product, { foreignKey: "productId" });

Order.hasMany(Payment, { foreignKey: "orderId", onDelete: "CASCADE" });
Payment.belongsTo(Order, { foreignKey: "orderId" });

User.hasMany(Payment, { foreignKey: "userId", onDelete: "CASCADE" });
Payment.belongsTo(User, { foreignKey: "userId" });

// Review Relationships
User.hasMany(Review, { foreignKey: "userId", onDelete: "CASCADE" });
Review.belongsTo(User, { foreignKey: "userId" });

Course.hasMany(Review, {
  foreignKey: "courseId",
  as: "reviews",
  onDelete: "CASCADE",
});
Review.belongsTo(Course, { foreignKey: "courseId" });

// Blog Relationships
User.hasMany(Blog, {
  foreignKey: "authorId",
  as: "blogs",
  onDelete: "CASCADE",
});
Blog.belongsTo(User, { foreignKey: "authorId", as: "author" });

// Notification Relationships
User.hasMany(Notification, { foreignKey: "userId", onDelete: "CASCADE" });
Notification.belongsTo(User, { foreignKey: "userId" });

// Ticket Relationships
User.hasMany(Ticket, { foreignKey: "userId", onDelete: "CASCADE" });
Ticket.belongsTo(User, { foreignKey: "userId" });

Ticket.hasMany(TicketReply, {
  foreignKey: "ticketId",
  as: "replies",
  onDelete: "CASCADE",
});
TicketReply.belongsTo(Ticket, { foreignKey: "ticketId" });

User.hasMany(TicketReply, { foreignKey: "userId", onDelete: "CASCADE" });
TicketReply.belongsTo(User, { foreignKey: "userId" });

// Monthly Goal Relationships
User.hasMany(MonthlyGoal, { foreignKey: "userId", onDelete: "CASCADE" });
MonthlyGoal.belongsTo(User, { foreignKey: "userId" });

// Transaction Relationships
User.hasMany(Transaction, { foreignKey: "userId", onDelete: "CASCADE" });
Transaction.belongsTo(User, { foreignKey: "userId" });

Transaction.belongsTo(Course, { foreignKey: "courseId", constraints: false });
Transaction.belongsTo(Order, { foreignKey: "orderId", constraints: false });
Transaction.belongsTo(Coupon, { foreignKey: "couponId", constraints: false });

// Address Relationships
User.hasMany(Address, { foreignKey: "userId", onDelete: "CASCADE" });
Address.belongsTo(User, { foreignKey: "userId" });

Order.belongsTo(Address, { foreignKey: "addressId", constraints: false });

// Coupon Usage Relationships
Coupon.hasMany(CouponUsage, { foreignKey: "couponId", onDelete: "CASCADE" });
CouponUsage.belongsTo(Coupon, { foreignKey: "couponId" });

User.hasMany(CouponUsage, { foreignKey: "userId", onDelete: "CASCADE" });
CouponUsage.belongsTo(User, { foreignKey: "userId" });

CouponUsage.belongsTo(Transaction, {
  foreignKey: "transactionId",
  constraints: false,
});

export {
  sequelize,
  User,
  RefreshToken,
  VerificationToken,
  Category,
  Course,
  Section,
  Lecture,
  Enrollment,
  LectureProgress,
  Product,
  Order,
  OrderItem,
  Payment,
  Review,
  HomepageContent,
  Blog,
  Faq,
  Notification,
  Ticket,
  TicketReply,
  MonthlyGoal,
  Transaction,
  Address,
  Coupon,
  CouponUsage,
  InvoiceCounter,
  OrderCounter,
};
