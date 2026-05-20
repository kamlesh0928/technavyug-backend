import { jest } from "@jest/globals";
import "dotenv/config";
import request from "supertest";
import bcrypt from "bcryptjs";

import app from "../src/app.js";
import {
  sequelize,
  User,
  Address,
  Coupon,
  CouponUsage,
  Transaction,
  Course,
  Product,
  Enrollment,
} from "../src/models/index.js";

import phonepeService from "../src/services/phonepe.service.js";

jest.unstable_mockModule("../src/services/email.service.js", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.setTimeout(15000);

let testUser;
let authToken;

beforeAll(async () => {
  await sequelize.authenticate();
  jest.spyOn(phonepeService, "initiatePayment").mockResolvedValue({
    redirectUrl: "https://phonepe.com/pay/test-checkout-url",
  });
  jest.spyOn(phonepeService, "getPaymentStatus").mockResolvedValue({
    state: "COMPLETED",
    transactionId: "PP_TXN_123",
  });
});

beforeEach(async () => {
  await sequelize.sync({ force: true });
  jest.clearAllMocks();

  // Create a test user and get auth token
  const hashedPassword = await bcrypt.hash("password123", 10);
  testUser = await User.create({
    name: "Test Student",
    email: "student@test.com",
    password: hashedPassword,
    role: "Student",
    emailVerified: true,
  });

  const loginRes = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: "student@test.com", password: "password123" });
  authToken = loginRes.body.accessToken;
});

afterAll(async () => {
  await sequelize.close();
});

// ADDRESS ENDPOINTS

describe("Address API (/api/v1/addresses)", () => {
  describe("POST /api/v1/addresses", () => {
    test("Should create a new address", async () => {
      const res = await request(app)
        .post("/api/v1/addresses")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "John Doe",
          phone: "9876543210",
          addressLine1: "123 Main St",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400001",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("John Doe");
      expect(res.body.data.isDefault).toBe(true); // First address is auto-default
    });

    test("Should fail without required fields", async () => {
      const res = await request(app)
        .post("/api/v1/addresses")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ name: "John Doe" }); // Missing phone, addressLine1, etc.

      expect(res.status).toBe(422);
    });

    test("Should fail without auth", async () => {
      const res = await request(app).post("/api/v1/addresses").send({
        name: "John",
        phone: "1234567890",
        addressLine1: "St",
        city: "X",
        state: "Y",
        pincode: "123456",
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/addresses", () => {
    test("Should list user addresses", async () => {
      await Address.create({
        userId: testUser.id,
        name: "Home",
        phone: "111",
        addressLine1: "Addr",
        city: "C",
        state: "S",
        pincode: "111111",
      });

      const res = await request(app)
        .get("/api/v1/addresses")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe("DELETE /api/v1/addresses/:id", () => {
    test("Should delete an address", async () => {
      const addr = await Address.create({
        userId: testUser.id,
        name: "Home",
        phone: "111",
        addressLine1: "Addr",
        city: "C",
        state: "S",
        pincode: "111111",
      });

      const res = await request(app)
        .delete(`/api/v1/addresses/${addr.id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const deleted = await Address.findByPk(addr.id);
      expect(deleted).toBeNull();
    });

    test("Should not delete another user's address", async () => {
      const otherUser = await User.create({
        name: "Other",
        email: "other@test.com",
        password: "x",
      });
      const addr = await Address.create({
        userId: otherUser.id,
        name: "Other Home",
        phone: "222",
        addressLine1: "Addr2",
        city: "C",
        state: "S",
        pincode: "222222",
      });

      const res = await request(app)
        .delete(`/api/v1/addresses/${addr.id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/v1/addresses/:id/default", () => {
    test("Should set an address as default", async () => {
      const addr1 = await Address.create({
        userId: testUser.id,
        name: "A1",
        phone: "111",
        addressLine1: "X",
        city: "C",
        state: "S",
        pincode: "111111",
        isDefault: true,
      });
      const addr2 = await Address.create({
        userId: testUser.id,
        name: "A2",
        phone: "222",
        addressLine1: "Y",
        city: "C",
        state: "S",
        pincode: "222222",
      });

      const res = await request(app)
        .patch(`/api/v1/addresses/${addr2.id}/default`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);

      const refreshedAddr1 = await Address.findByPk(addr1.id);
      const refreshedAddr2 = await Address.findByPk(addr2.id);
      expect(refreshedAddr1.isDefault).toBe(false);
      expect(refreshedAddr2.isDefault).toBe(true);
    });
  });
});

// COUPON ENDPOINTS

describe("Coupon API (/api/v1/coupons)", () => {
  describe("POST /api/v1/coupons/validate", () => {
    test("Should validate a valid coupon", async () => {
      await Coupon.create({
        code: "SAVE20",
        discountType: "percentage",
        discountValue: 20,
        expiryDate: "2030-12-31",
        applicableTo: "all",
      });

      const res = await request(app)
        .post("/api/v1/coupons/validate")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ code: "SAVE20", subtotal: 1000 });

      expect(res.status).toBe(200);
      expect(res.body.data.discountAmount).toBe(200);
      expect(res.body.data.finalAmount).toBe(800);
    });

    test("Should reject an expired coupon", async () => {
      await Coupon.create({
        code: "EXPIRED10",
        discountType: "flat",
        discountValue: 100,
        expiryDate: "2020-01-01",
        applicableTo: "all",
      });

      const res = await request(app)
        .post("/api/v1/coupons/validate")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ code: "EXPIRED10", subtotal: 500 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/expired/i);
    });

    test("Should reject invalid coupon code", async () => {
      const res = await request(app)
        .post("/api/v1/coupons/validate")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ code: "DOESNOTEXIST", subtotal: 500 });

      expect(res.status).toBe(404);
    });

    test("Should reject coupon already used by this user", async () => {
      const coupon = await Coupon.create({
        code: "ONCE10",
        discountType: "flat",
        discountValue: 10,
        expiryDate: "2030-12-31",
        applicableTo: "all",
      });

      await CouponUsage.create({
        couponId: coupon.id,
        userId: testUser.id,
        transactionId: "00000000-0000-0000-0000-000000000000",
      });

      const res = await request(app)
        .post("/api/v1/coupons/validate")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ code: "ONCE10", subtotal: 500 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already used/i);
    });

    test("Should cap percentage discount at maxDiscount", async () => {
      await Coupon.create({
        code: "MAX50",
        discountType: "percentage",
        discountValue: 50,
        maxDiscount: 100,
        expiryDate: "2030-12-31",
        applicableTo: "all",
      });

      const res = await request(app)
        .post("/api/v1/coupons/validate")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ code: "MAX50", subtotal: 1000 });

      expect(res.status).toBe(200);
      // 50% of 1000 = 500, but max is 100
      expect(res.body.data.discountAmount).toBe(100);
    });

    test("Should reject coupon below minimum order amount", async () => {
      await Coupon.create({
        code: "MIN500",
        discountType: "flat",
        discountValue: 50,
        minOrderAmount: 500,
        expiryDate: "2030-12-31",
        applicableTo: "all",
      });

      const res = await request(app)
        .post("/api/v1/coupons/validate")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ code: "MIN500", subtotal: 200 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/minimum/i);
    });
  });

  describe("Admin Coupon CRUD", () => {
    let adminToken;

    beforeEach(async () => {
      const adminPw = await bcrypt.hash("admin123", 10);
      await User.create({
        name: "Admin",
        email: "admin@test.com",
        password: adminPw,
        role: "Admin",
        emailVerified: true,
      });
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "admin@test.com", password: "admin123" });
      adminToken = loginRes.body.accessToken;
    });

    test("Should create a coupon (admin)", async () => {
      const res = await request(app)
        .post("/api/v1/coupons")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: "NEWCOUPON",
          discountType: "flat",
          discountValue: 50,
          expiryDate: "2030-12-31",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe("NEWCOUPON");
    });

    test("Should reject coupon creation from non-admin", async () => {
      const res = await request(app)
        .post("/api/v1/coupons")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          code: "STUDENTCOUPON",
          discountType: "flat",
          discountValue: 50,
          expiryDate: "2030-12-31",
        });

      expect(res.status).toBe(403);
    });

    test("Should list coupons (admin)", async () => {
      await Coupon.create({
        code: "C1",
        discountType: "flat",
        discountValue: 10,
        expiryDate: "2030-12-31",
      });
      await Coupon.create({
        code: "C2",
        discountType: "percentage",
        discountValue: 20,
        expiryDate: "2030-12-31",
      });

      const res = await request(app)
        .get("/api/v1/coupons")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    test("Should delete a coupon (admin)", async () => {
      const coupon = await Coupon.create({
        code: "DEL",
        discountType: "flat",
        discountValue: 10,
        expiryDate: "2030-12-31",
      });

      const res = await request(app)
        .delete(`/api/v1/coupons/${coupon.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });
});

// PHONEPE PAYMENT ENDPOINTS

describe("PhonePe Payment API (/api/v1/phonepe)", () => {
  describe("POST /api/v1/phonepe/initiate-course-payment", () => {
    test("Should initiate a course payment", async () => {
      const instructor = await User.create({
        name: "Prof",
        email: "prof@test.com",
        password: "x",
        role: "Instructor",
      });
      const course = await Course.create({
        title: "Test Course",
        slug: "test-course",
        price: 999,
        status: "Published",
        instructorId: instructor.id,
        level: "Beginner",
      });

      const res = await request(app)
        .post("/api/v1/phonepe/initiate-course-payment")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ courseId: course.id });

      expect(res.status).toBe(200);
      expect(res.body.data.checkoutUrl).toBeDefined();
      expect(res.body.data.merchantOrderId).toMatch(/^CRS-/);

      // Verify transaction was created
      const txn = await Transaction.findOne({
        where: { merchantOrderId: res.body.data.merchantOrderId },
      });
      expect(txn).not.toBeNull();
      expect(txn.status).toBe("Pending");
      expect(txn.paymentType).toBe("course");
    });

    test("Should reject payment for a free course", async () => {
      const instructor = await User.create({
        name: "Prof",
        email: "prof@test.com",
        password: "x",
        role: "Instructor",
      });
      const course = await Course.create({
        title: "Free Course",
        slug: "free-course",
        price: 0,
        status: "Published",
        instructorId: instructor.id,
        level: "Beginner",
      });

      const res = await request(app)
        .post("/api/v1/phonepe/initiate-course-payment")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ courseId: course.id });

      expect(res.status).toBe(400);
    });

    test("Should reject payment if already enrolled", async () => {
      const instructor = await User.create({
        name: "Prof",
        email: "prof@test.com",
        password: "x",
        role: "Instructor",
      });
      const course = await Course.create({
        title: "Owned Course",
        slug: "owned-course",
        price: 500,
        status: "Published",
        instructorId: instructor.id,
        level: "Beginner",
      });
      await Enrollment.create({
        userId: testUser.id,
        courseId: course.id,
        status: "Active",
      });

      const res = await request(app)
        .post("/api/v1/phonepe/initiate-course-payment")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ courseId: course.id });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already own/i);
    });
  });

  describe("POST /api/v1/phonepe/initiate-order-payment", () => {
    test("Should initiate an order payment", async () => {
      const product = await Product.create({
        name: "Widget",
        slug: "widget",
        price: 500,
        stock: 10,
        type: "Physical",
        status: "Active",
      });
      const address = await Address.create({
        userId: testUser.id,
        name: "Home",
        phone: "111",
        addressLine1: "St",
        city: "C",
        state: "S",
        pincode: "111111",
      });

      const res = await request(app)
        .post("/api/v1/phonepe/initiate-order-payment")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          items: [{ productId: product.id, quantity: 2 }],
          addressId: address.id,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.checkoutUrl).toBeDefined();
      expect(res.body.data.merchantOrderId).toMatch(/^ORD-/);
    });

    test("Should reject order without address", async () => {
      const product = await Product.create({
        name: "Widget",
        slug: "widget-2",
        price: 500,
        stock: 10,
        type: "Physical",
        status: "Active",
      });

      const res = await request(app)
        .post("/api/v1/phonepe/initiate-order-payment")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          items: [{ productId: product.id, quantity: 1 }],
        });

      expect(res.status).toBe(422);
    });

    test("Should reject order with insufficient stock", async () => {
      const product = await Product.create({
        name: "Widget",
        slug: "widget-3",
        price: 500,
        stock: 1,
        type: "Physical",
        status: "Active",
      });
      const address = await Address.create({
        userId: testUser.id,
        name: "Home",
        phone: "111",
        addressLine1: "St",
        city: "C",
        state: "S",
        pincode: "111111",
      });

      const res = await request(app)
        .post("/api/v1/phonepe/initiate-order-payment")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          items: [{ productId: product.id, quantity: 5 }],
          addressId: address.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/insufficient stock/i);
    });
  });

  describe("GET /api/v1/phonepe/course-payment-status/:merchantOrderId", () => {
    test("Should return success for completed payment and grant enrollment", async () => {
      const instructor = await User.create({
        name: "Prof",
        email: "prof@test.com",
        password: "x",
        role: "Instructor",
      });
      const course = await Course.create({
        title: "Paid Course",
        slug: "paid-course",
        price: 999,
        status: "Published",
        instructorId: instructor.id,
        level: "Beginner",
      });

      const txn = await Transaction.create({
        merchantOrderId: "CRS-TEST-001",
        userId: testUser.id,
        amount: 999,
        originalAmount: 999,
        paymentType: "course",
        courseId: course.id,
        status: "Pending",
      });

      const res = await request(app)
        .get(`/api/v1/phonepe/course-payment-status/${txn.merchantOrderId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("Success");

      // Verify enrollment was created
      const enrollment = await Enrollment.findOne({
        where: { userId: testUser.id, courseId: course.id },
      });
      expect(enrollment).not.toBeNull();
    });
  });
});
