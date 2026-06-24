import express from "express";
import {
  createMenu,
  deleteMenuItem,
  getAllMenu,
  getMenuId,
  updateMenu,
} from "../../controllers/menuController";
import { authenticate, requirePermission } from "../../middleware/auth";

const router = express.Router();

// Menu reads are public (landing page + customer ordering UI).
router.get("/", getAllMenu);
router.get("/:id", getMenuId);

// Mutations require authenticated staff with menu:write.
router.post("/", authenticate, requirePermission("menu:write"), createMenu);
router.put("/:id", authenticate, requirePermission("menu:write"), updateMenu);
router.delete(
  "/:id",
  authenticate,
  requirePermission("menu:write"),
  deleteMenuItem,
);

export default router;
