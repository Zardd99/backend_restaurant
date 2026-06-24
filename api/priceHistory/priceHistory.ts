import express from "express";
import {
  getAllPriceHistories,
  getPriceHistoryById,
} from "../../controllers/priceHistoryController";
import { authenticate, requirePermission } from "../../middleware/auth";

const router = express.Router();

router.use(authenticate);

router.get("/", requirePermission("price:read"), getAllPriceHistories);
router.get("/:id", requirePermission("price:read"), getPriceHistoryById);

export default router;
