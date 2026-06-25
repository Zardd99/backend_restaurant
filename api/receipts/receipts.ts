import express from "express";
import { apiLimiter } from "../../middleware/apiLimiter";
import {
  createReceipt,
  getAllReceipts,
  getReceiptById,
  getReceiptByOrderId,
  updateReceipt,
} from "../../controllers/receiptController";
import { authenticate, requirePermission } from "../../middleware/auth";

const router = express.Router();

router.use(apiLimiter);

router.use(authenticate);

router.get("/", requirePermission("receipt:list"), getAllReceipts);
router.get(
  "/order/:orderId",
  requirePermission("receipt:read"),
  getReceiptByOrderId,
);
router.get("/:id", requirePermission("receipt:read"), getReceiptById);
router.post("/", requirePermission("receipt:write"), createReceipt);
router.put("/:id", requirePermission("receipt:write"), updateReceipt);

export default router;
