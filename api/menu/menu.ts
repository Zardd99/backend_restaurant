import express from "express";
import {
  createMenu,
  deleteMenuItem,
  getAllMenu,
  getMenuId,
  updateMenu,
} from "../../controllers/menuController";

const router = express.Router();

router.get("/", getAllMenu);
router.get("/:id", getMenuId);
router.post("/", createMenu);
router.put("/:id", updateMenu);
router.delete("/:id", deleteMenuItem);

export default router;
