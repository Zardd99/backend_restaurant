import express from "express";
import {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
} from "../../controllers/authController";
import { authenticate } from "../../middleware/auth";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticate, getMe);
router.put("/update", authenticate, updateProfile);
router.put("/change-password", authenticate, changePassword);
router.delete("/account", authenticate, deleteAccount);

export default router;
