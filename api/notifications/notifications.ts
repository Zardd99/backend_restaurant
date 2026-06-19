import express from "express";
import { authenticate, authorize } from "../../middleware/auth";
import {
  getNotifications,
  markAllRead,
  deleteAllNotifications,
} from "../../controllers/notificationController";

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorize("admin", "manager", "chef", "waiter", "cashier"),
  getNotifications,
);

router.patch(
  "/read",
  authorize("admin", "manager", "chef", "waiter", "cashier"),
  markAllRead,
);

router.delete(
  "/",
  authorize("admin", "manager"),
  deleteAllNotifications,
);

export default router;
