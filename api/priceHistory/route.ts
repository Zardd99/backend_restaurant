import express from "express";
import {
  getAllPriceHistories,
  getPriceHistoryById,
} from "../../controllers/priceHistoryController";

const router = express.Router();

router.get("/", getAllPriceHistories);
router.get("/:id", getPriceHistoryById);

export default router;
