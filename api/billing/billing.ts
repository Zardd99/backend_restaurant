import express from "express";
import { getServedOrders, processPayment } from "../../controllers/billingController";
import { authenticate, authorize } from "../../middleware/auth";

const router = express.Router();
router.use(authenticate);

router.get(
  "/served",
  authorize("admin", "manager", "cashier", "waiter"),
  getServedOrders,
);

router.patch(
  "/:id/pay",
  authorize("admin", "manager", "cashier", "waiter"),
  processPayment,
);

export default router;
