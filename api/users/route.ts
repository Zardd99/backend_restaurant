import express from "express";
import {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
} from "../../controllers/userController";
import { authenticate, authorize } from "../../middleware/auth";

const router = express.Router();

// All routes protected and admin only
router.use(authenticate, authorize("admin"));

router.get("/", getUsers);
router.get("/:id", getUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;
