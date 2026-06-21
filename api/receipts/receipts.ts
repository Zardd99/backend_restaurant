import express from "express";
import {
  createReceipt,
  getAllReceipts,
  getReceiptById,
  getReceiptByOrderId,
  updateReceipt,
} from "../../controllers/receiptController";
import { authenticate, authorize } from "../../middleware/auth";

const router = express.Router();

router.use(authenticate);

router.get("/", authorize("admin", "manager"), getAllReceipts);
router.get("/order/:orderId", authorize("admin", "manager", "cashier"), getReceiptByOrderId);
router.get("/:id", authorize("admin", "manager", "cashier"), getReceiptById);
router.post("/", authorize("admin", "manager", "cashier"), createReceipt);
router.put("/:id", authorize("admin", "manager"), updateReceipt);

export default router;
