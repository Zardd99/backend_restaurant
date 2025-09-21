import express from "express";
import {
  createReceipt,
  getAllReceipts,
  getReceiptById,
  getReceiptByOrderId,
  updateReceipt,
} from "../../controllers/receiptController";

const router = express.Router();

router.post("/", createReceipt);
router.get("/", getAllReceipts);
router.get("/:id", getReceiptById);
router.get("/order/:orderId", getReceiptByOrderId);
router.put("/:id", updateReceipt);

export default router;
