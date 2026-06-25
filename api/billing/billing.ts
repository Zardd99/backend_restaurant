import express from "express";
import { apiLimiter } from "../../middleware/apiLimiter";
import { getServedOrders, processPayment } from "../../controllers/billingController";
import { authenticate, requirePermission } from "../../middleware/auth";

const router = express.Router();

router.use(apiLimiter);
router.use(authenticate);

router.get("/served", requirePermission("billing:read"), getServedOrders);

router.patch("/:id/pay", requirePermission("billing:pay"), processPayment);

export default router;
