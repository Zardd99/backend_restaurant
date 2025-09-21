import express from "express";
import { getAllCategory } from "../../controllers/categoryController";

const router = express.Router();

router.get("/", getAllCategory);

export default router;
