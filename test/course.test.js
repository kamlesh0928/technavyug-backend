import { jest } from "@jest/globals";
import "dotenv/config";
import request from "supertest";
import bcrypt from "bcryptjs";

import app from "../src/app.js";
import {
  sequelize,
  User,
  Course,
  Section,
  Lecture,
} from "../src/models/index.js";

jest.setTimeout(15000);

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

/**
 * Helper: Create a user and get an auth token.
 */
const createAuthUser = async (
  role = "Instructor",
  email = "instructor@test.com",
) => {
  const hashedPassword = await bcrypt.hash("password123", 10);
  const user = await User.create({
    name: "Test " + role,
    email,
    password: hashedPassword,
    role,
    emailVerified: true,
  });

  const loginRes = await request(app).post("/api/v1/auth/login").send({
    email,
    password: "password123",
  });

  return { user, token: loginRes.body.accessToken };
};

describe("Course Management API Endpoints", () => {
  // Course CRUD
  describe("POST /api/v1/courses", () => {
    test("Should create a course as an Instructor", async () => {
      const { token } = await createAuthUser("Instructor");

      const response = await request(app)
        .post("/api/v1/courses")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Learn Node.js",
          description: "A comprehensive Node.js course",
          shortDescription: "Node from scratch",
          price: "499.00",
          level: "Beginner",
          language: "English",
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.title).toBe("Learn Node.js");
      expect(response.body.data.slug).toMatch(/^learn-node/);
    });

    test("Should fail without title", async () => {
      const { token } = await createAuthUser("Instructor");

      const response = await request(app)
        .post("/api/v1/courses")
        .set("Authorization", `Bearer ${token}`)
        .send({ description: "No title provided" });

      expect(response.status).toBe(422);
    });

    test("Should fail without authentication", async () => {
      const response = await request(app)
        .post("/api/v1/courses")
        .send({ title: "Unauthorized Course" });

      expect(response.status).toBe(401);
    });

    test("Should reject Student role", async () => {
      const { token } = await createAuthUser(
        "Student",
        "student@test.com",
      );

      const response = await request(app)
        .post("/api/v1/courses")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Student Course" });

      expect(response.status).toBe(403);
    });
  });

  describe("GET /api/v1/courses", () => {
    test("Should list courses publicly", async () => {
      const { user } = await createAuthUser("Instructor");
      await Course.create({
        title: "Public Course",
        slug: "public-course",
        instructorId: user.id,
        status: "Published",
      });

      const response = await request(app).get("/api/v1/courses");
      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });
  });

  // Section CRUD
  describe("Sections", () => {
    test("Should create a section for a course", async () => {
      const { user, token } = await createAuthUser("Instructor");
      const course = await Course.create({
        title: "Course with Sections",
        slug: "course-with-sections",
        instructorId: user.id,
      });

      const response = await request(app)
        .post(`/api/v1/courses/${course.id}/sections`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Introduction" });

      expect(response.status).toBe(201);
      expect(response.body.data.title).toBe("Introduction");
      expect(response.body.data.order).toBe(1);
    });
  });

  // Lecture CRUD (no file upload - JSON body only)
  describe("Lectures", () => {
    test("Should create a lecture with videoUrl in body", async () => {
      const { user, token } = await createAuthUser("Instructor");

      const course = await Course.create({
        title: "Course for Lectures",
        slug: "course-lectures",
        instructorId: user.id,
      });

      const section = await Section.create({
        courseId: course.id,
        title: "Section One",
        order: 1,
      });

      const response = await request(app)
        .post(`/api/v1/courses/sections/${section.id}/lectures`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Welcome Video",
          type: "Video",
          videoUrl: "https://example.com/video.mp4",
          duration: 300,
          isFree: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.title).toBe("Welcome Video");
      expect(response.body.data.videoUrl).toBe(
        "https://example.com/video.mp4",
      );
      expect(response.body.data.isFree).toBe(true);

      // Verify course aggregates updated
      const updatedCourse = await Course.findByPk(course.id);
      expect(updatedCourse.totalLectures).toBe(1);
      expect(updatedCourse.totalDuration).toBe(300);
    });

    test("Should delete a lecture", async () => {
      const { user, token } = await createAuthUser("Instructor");

      const course = await Course.create({
        title: "Delete Lecture Course",
        slug: "delete-lecture-course",
        instructorId: user.id,
      });
      const section = await Section.create({
        courseId: course.id,
        title: "Section",
        order: 1,
      });
      const lecture = await Lecture.create({
        sectionId: section.id,
        title: "To Delete",
        type: "Video",
        order: 1,
        duration: 60,
      });

      const response = await request(app)
        .delete(`/api/v1/courses/lectures/${lecture.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);

      const deletedLecture = await Lecture.findByPk(lecture.id);
      expect(deletedLecture).toBeNull();
    });
  });
});
