import express from "express";
import userController from "../../controllers/admin/user.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

// Read-only access for all admins
router.get(
  "/",
  authorize("Super Admin", "Admin", "Sub Admin"),
  userController.listUsers,
);
router.get(
  "/:id",
  authorize("Super Admin", "Admin", "Sub Admin"),
  userController.getUserById,
);

// Write/CRUD access for Super Admin ONLY
router.post("/", authorize("Super Admin"), userController.createUser);
router.put("/:id", authorize("Super Admin"), userController.updateUser);
router.delete("/:id", authorize("Super Admin"), userController.deleteUser);
router.patch("/:id/block", authorize("Super Admin"), userController.blockUser);
router.patch(
  "/:id/unblock",
  authorize("Super Admin"),
  userController.unblockUser,
);

export default router;
