import { jest } from "@jest/globals";
import "dotenv/config";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import app from "../src/app.js";
import {
  sequelize,
  User,
  Category,
  Course,
  Section,
  Lecture,
  Enrollment,
  Product,
  Order,
  Review,
  Notification,
  Ticket,
} from "../src/models/index.js";

jest.setTimeout(30000);

// --- Helper Functions ---

const createUser = async (overrides = {}) => {
  const defaults = {
    name: "Test User",
    email: `test-${Date.now()}@example.com`,
    password: await bcrypt.hash("password123", 10),
    role: "Student",
    emailVerified: true,
    status: "Active",
  };
  return User.create({ ...defaults, ...overrides });
};

const getAuthToken = (user) => {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
};

// --- Setup / Teardown ---

beforeAll(async () => {
  await sequelize.authenticate();
});

beforeEach(async () => {
  await sequelize.sync({ force: true });
  jest.clearAllMocks();
});

afterAll(async () => {
  await sequelize.close();
});

// ===== User Management Tests =====

describe("Admin User Management", () => {
  let admin, student, token;

  beforeEach(async () => {
    admin = await createUser({ role: "Super Admin", email: "admin@test.com" });
    student = await createUser({ role: "Student", email: "student@test.com" });
    token = getAuthToken(admin);
  });

  test("Should list users with pagination", async () => {
    const res = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.totalItems).toBe(2);
  });

  test("Should filter users by role", async () => {
    const res = await request(app)
      .get("/api/v1/admin/users?role=Student")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].role).toBe("Student");
  });

  test("Should block a user", async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${student.id}/block`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const updated = await User.findByPk(student.id);
    expect(updated.status).toBe("Blocked");
  });

  test("Should unblock a user", async () => {
    student.status = "Blocked";
    await student.save();

    const res = await request(app)
      .patch(`/api/v1/admin/users/${student.id}/unblock`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const updated = await User.findByPk(student.id);
    expect(updated.status).toBe("Active");
  });

  test("Should deny non-admin access", async () => {
    const studentToken = getAuthToken(student);
    const res = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });

  test("Should delete a user", async () => {
    const res = await request(app)
      .delete(`/api/v1/admin/users/${student.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const deleted = await User.findByPk(student.id);
    expect(deleted).toBeNull();
  });
});

// ===== Category Tests =====

describe("Category Management", () => {
  let admin, token;

  beforeEach(async () => {
    admin = await createUser({ role: "Admin", email: "admin@test.com" });
    token = getAuthToken(admin);
  });

  test("Should create a category", async () => {
    const res = await request(app)
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Web Development", description: "Web dev courses" });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Web Development");
    expect(res.body.data.slug).toBeDefined();
  });

  test("Should list categories (public)", async () => {
    await Category.create({ name: "Cat 1", slug: "cat-1" });
    await Category.create({ name: "Cat 2", slug: "cat-2" });

    const res = await request(app).get("/api/v1/categories");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });
});

// ===== Course Management Tests =====

describe("Course Management", () => {
  let instructor, student, _adminToken, instructorToken, studentToken, category;

  beforeEach(async () => {
    const admin = await createUser({ role: "Admin", email: "admin@test.com" });
    instructor = await createUser({
      role: "Instructor",
      email: "instructor@test.com",
    });
    student = await createUser({ role: "Student", email: "student@test.com" });

    _adminToken = getAuthToken(admin);
    instructorToken = getAuthToken(instructor);
    studentToken = getAuthToken(student);

    category = await Category.create({
      name: "Programming",
      slug: "programming",
    });
  });

  test("Should create a course", async () => {
    const res = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({
        title: "Node.js Fundamentals",
        description: "Learn Node.js from scratch",
        price: 49.99,
        categoryId: category.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("Node.js Fundamentals");
    expect(res.body.data.instructorId).toBe(instructor.id);
  });

  test("Should list courses (public)", async () => {
    await Course.create({
      title: "Course 1",
      slug: "course-1-abc",
      instructorId: instructor.id,
      price: 0,
    });

    const res = await request(app).get("/api/v1/courses");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  test("Should add sections to a course", async () => {
    const course = await Course.create({
      title: "Course",
      slug: "course-sec-abc",
      instructorId: instructor.id,
      price: 0,
    });

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/sections`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({ title: "Introduction" });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("Introduction");
    expect(res.body.data.courseId).toBe(course.id);
  });

  test("Should add lectures to a section", async () => {
    const course = await Course.create({
      title: "Course",
      slug: "course-lec-abc",
      instructorId: instructor.id,
      price: 0,
    });
    const section = await Section.create({
      courseId: course.id,
      title: "Intro",
      order: 1,
    });

    const res = await request(app)
      .post(`/api/v1/courses/sections/${section.id}/lectures`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({
        title: "Welcome Video",
        type: "Video",
        videoUrl: "https://example.com/video.mp4",
        duration: 300,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("Welcome Video");
  });

  test("Should deny student from creating courses", async () => {
    const res = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ title: "Denied Course", price: 10 });

    expect(res.status).toBe(403);
  });
});

// ===== Enrollment & Progress Tests =====

describe("Enrollment and Progress", () => {
  let student, instructor, token, course, section, lecture;

  beforeEach(async () => {
    instructor = await createUser({
      role: "Instructor",
      email: "instructor@test.com",
    });
    student = await createUser({ role: "Student", email: "student@test.com" });
    token = getAuthToken(student);

    course = await Course.create({
      title: "Test Course",
      slug: "test-course-enr",
      instructorId: instructor.id,
      price: 0,
      status: "Published",
    });
    section = await Section.create({
      courseId: course.id,
      title: "S1",
      order: 1,
    });
    lecture = await Lecture.create({
      sectionId: section.id,
      title: "L1",
      order: 1,
      duration: 60,
    });
  });

  test("Should enroll in a course", async () => {
    const res = await request(app)
      .post(`/api/v1/enrollments/courses/${course.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.data.userId).toBe(student.id);
    expect(res.body.data.courseId).toBe(course.id);
  });

  test("Should prevent duplicate enrollment", async () => {
    await Enrollment.create({ userId: student.id, courseId: course.id });

    const res = await request(app)
      .post(`/api/v1/enrollments/courses/${course.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test("Should get my enrollments", async () => {
    await Enrollment.create({ userId: student.id, courseId: course.id });

    const res = await request(app)
      .get("/api/v1/enrollments/my")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  test("Should mark lecture as complete and return progress", async () => {
    await Enrollment.create({ userId: student.id, courseId: course.id });

    const res = await request(app)
      .post(`/api/v1/enrollments/progress/${lecture.id}/complete`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.courseProgress).toBe(100);
  });
});

// ===== E-Commerce Tests =====

describe("E-Commerce: Products and Orders", () => {
  let admin, student, adminToken, studentToken, product;

  beforeEach(async () => {
    admin = await createUser({ role: "Admin", email: "admin@test.com" });
    student = await createUser({ role: "Student", email: "student@test.com" });
    adminToken = getAuthToken(admin);
    studentToken = getAuthToken(student);

    product = await Product.create({
      name: "Node.js Book",
      slug: "nodejs-book-abc",
      price: 29.99,
      stock: 10,
      type: "Physical",
      status: "Active",
    });
  });

  test("Should list products (public)", async () => {
    const res = await request(app).get("/api/v1/products");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  test("Should create a product (admin)", async () => {
    const res = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "React Guide", price: 19.99 });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("React Guide");
  });

  test("Should place an order", async () => {
    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        items: [{ productId: product.id, quantity: 2 }],
        shippingAddress: { street: "123 Main St", city: "Delhi" },
      });

    expect(res.status).toBe(201);
    expect(parseFloat(res.body.data.totalAmount)).toBeCloseTo(70.78, 2);
    expect(res.body.data.items.length).toBe(1);

    // Verify stock was decremented
    const updated = await Product.findByPk(product.id);
    expect(updated.stock).toBe(8);
  });

  test("Should reject order with insufficient stock", async () => {
    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        items: [{ productId: product.id, quantity: 999 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Insufficient stock/);
  });

  test("Should update order status (admin)", async () => {
    const order = await Order.create({
      orderNumber: "ORD-TEST-001",
      userId: student.id,
      totalAmount: 29.99,
    });

    const res = await request(app)
      .patch(`/api/v1/orders/${order.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "Processing" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("Processing");
  });
});

// ===== Review Tests =====

describe("Reviews and Ratings", () => {
  let student, instructor, token, course;

  beforeEach(async () => {
    instructor = await createUser({
      role: "Instructor",
      email: "instructor@test.com",
    });
    student = await createUser({ role: "Student", email: "student@test.com" });
    token = getAuthToken(student);

    course = await Course.create({
      title: "Review Course",
      slug: "review-course-abc",
      instructorId: instructor.id,
      price: 0,
      status: "Published",
    });

    await Enrollment.create({ userId: student.id, courseId: course.id });
  });

  test("Should create a review", async () => {
    const res = await request(app)
      .post("/api/v1/reviews")
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: course.id, rating: 5, comment: "Excellent course" });

    expect(res.status).toBe(201);
    expect(res.body.data.rating).toBe(5);

    // Verify course rating was updated
    const updated = await Course.findByPk(course.id);
    expect(parseFloat(updated.averageRating)).toBe(5);
    expect(updated.totalReviews).toBe(1);
  });

  test("Should prevent duplicate reviews", async () => {
    await Review.create({ userId: student.id, courseId: course.id, rating: 4 });

    const res = await request(app)
      .post("/api/v1/reviews")
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: course.id, rating: 3 });

    expect(res.status).toBe(400);
  });

  test("Should list course reviews (public)", async () => {
    await Review.create({
      userId: student.id,
      courseId: course.id,
      rating: 4,
      comment: "Good",
    });

    const res = await request(app).get(`/api/v1/reviews/course/${course.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  test("Should require enrollment to review", async () => {
    const other = await createUser({ email: "other@test.com" });
    const otherToken = getAuthToken(other);

    const res = await request(app)
      .post("/api/v1/reviews")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ courseId: course.id, rating: 5 });

    expect(res.status).toBe(403);
  });
});

// ===== CMS Tests =====

describe("CMS: Blog, FAQ", () => {
  let admin, token;

  beforeEach(async () => {
    admin = await createUser({ role: "Admin", email: "admin@test.com" });
    token = getAuthToken(admin);
  });

  test("Should create and list blogs", async () => {
    await request(app)
      .post("/api/v1/cms/blogs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "First Blog",
        content: "Hello World",
        status: "Published",
      });

    const res = await request(app).get("/api/v1/cms/blogs");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  test("Should create and list FAQs", async () => {
    await request(app)
      .post("/api/v1/cms/faqs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "How to enroll?",
        answer: "Click enroll button",
        category: "General",
      });

    const res = await request(app).get("/api/v1/cms/faqs");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });
});

// ===== Notification Tests =====

describe("Notifications", () => {
  let admin, student, adminToken, studentToken;

  beforeEach(async () => {
    admin = await createUser({ role: "Admin", email: "admin@test.com" });
    student = await createUser({ role: "Student", email: "student@test.com" });
    adminToken = getAuthToken(admin);
    studentToken = getAuthToken(student);
  });

  test("Should send a notification to a user (admin)", async () => {
    const res = await request(app)
      .post("/api/v1/notifications/send")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        userId: student.id,
        title: "Welcome",
        message: "Welcome to the platform",
        channel: "InApp",
      });

    expect(res.status).toBe(201);
  });

  test("Should get my notifications", async () => {
    await Notification.create({
      userId: student.id,
      title: "Test",
      message: "Test notification",
    });

    const res = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  test("Should mark notification as read", async () => {
    const notification = await Notification.create({
      userId: student.id,
      title: "Test",
      message: "Test notification",
    });

    const res = await request(app)
      .patch(`/api/v1/notifications/${notification.id}/read`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    const updated = await Notification.findByPk(notification.id);
    expect(updated.isRead).toBe(true);
  });

  test("Should get unread count", async () => {
    await Notification.create({
      userId: student.id,
      title: "N1",
      message: "M1",
    });
    await Notification.create({
      userId: student.id,
      title: "N2",
      message: "M2",
    });

    const res = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.unreadCount).toBe(2);
  });
});

// ===== Ticket Tests =====

describe("Support Tickets", () => {
  let admin, student, adminToken, studentToken;

  beforeEach(async () => {
    admin = await createUser({ role: "Admin", email: "admin@test.com" });
    student = await createUser({ role: "Student", email: "student@test.com" });
    adminToken = getAuthToken(admin);
    studentToken = getAuthToken(student);
  });

  test("Should create a ticket", async () => {
    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ subject: "Login Issue", description: "Cannot log in" });

    expect(res.status).toBe(201);
    expect(res.body.data.subject).toBe("Login Issue");
    expect(res.body.data.ticketNumber).toBeDefined();
    expect(res.body.data.status).toBe("Open");
  });

  test("Should get my tickets", async () => {
    await Ticket.create({
      ticketNumber: "TKT-TEST-001",
      userId: student.id,
      subject: "Test",
      description: "Test ticket",
    });

    const res = await request(app)
      .get("/api/v1/tickets/my")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  test("Should reply to a ticket", async () => {
    const ticket = await Ticket.create({
      ticketNumber: "TKT-TEST-002",
      userId: student.id,
      subject: "Help",
      description: "Need help",
    });

    const res = await request(app)
      .post(`/api/v1/tickets/${ticket.id}/reply`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ message: "We are looking into it" });

    expect(res.status).toBe(201);
    expect(res.body.data.message).toBe("We are looking into it");

    // Ticket should be marked InProgress after admin reply
    const updated = await Ticket.findByPk(ticket.id);
    expect(updated.status).toBe("InProgress");
    expect(updated.assignedTo).toBe(admin.id);
  });

  test("Should update ticket status (admin)", async () => {
    const ticket = await Ticket.create({
      ticketNumber: "TKT-TEST-003",
      userId: student.id,
      subject: "Issue",
      description: "Some issue",
    });

    const res = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "Resolved" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("Resolved");
  });
});

// ===== Auth Middleware Tests =====

describe("Auth Middleware", () => {
  test("Should reject request without token", async () => {
    const res = await request(app).get("/api/v1/enrollments/my");
    expect(res.status).toBe(401);
  });

  test("Should reject request with invalid token", async () => {
    const res = await request(app)
      .get("/api/v1/enrollments/my")
      .set("Authorization", "Bearer invalidtoken123");

    expect(res.status).toBe(401);
  });

  test("Should reject blocked user", async () => {
    const blocked = await createUser({
      email: "blocked@test.com",
      status: "Blocked",
    });
    const token = getAuthToken(blocked);

    const res = await request(app)
      .get("/api/v1/enrollments/my")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
