import express from "express";
import { apiLimiter } from "../../middleware/apiLimiter";
import { authenticate, requirePermission } from "../../middleware/auth";
import {
  getNotifications,
  markAllRead,
  deleteAllNotifications,
} from "../../controllers/notificationController";

const router = express.Router();

router.use(apiLimiter);

router.use(authenticate);

router.get("/", requirePermission("notification:read"), getNotifications);
router.patch("/read", requirePermission("notification:read"), markAllRead);
router.delete(
  "/",
  requirePermission("notification:manage"),
  deleteAllNotifications,
);

export default router;
