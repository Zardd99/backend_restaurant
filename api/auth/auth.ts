import express from "express";
import {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
} from "../../controllers/authController";
import { authenticate } from "../../middleware/auth";
import rateLimiter from "../../middleware/rateLimter";

const router = express.Router();

// Strict throttle on credential endpoints to slow brute-force / abuse.
const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: "Too many attempts. Please try again later.",
  skipFailedRequests: false,
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", authenticate, getMe);
router.put("/update", authenticate, updateProfile);
router.put("/change-password", authenticate, changePassword);

export default router;
