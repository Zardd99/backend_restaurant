import express from "express";
import {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  updateUserRole,
} from "../../controllers/userController";
import { authenticate, requirePermission } from "../../middleware/auth";

const router = express.Router();

// All routes require staff-administration permission.
router.use(authenticate, requirePermission("user:manage"));

router.get("/", getUsers);
router.get("/:id", getUser);
router.put("/:id", updateUser);
router.patch("/:id/role", updateUserRole);
router.delete("/:id", deleteUser);

export default router;
