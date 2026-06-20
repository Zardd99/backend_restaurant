import express from "express";
import { sendSupportMessage } from "../../controllers/supportController";

const router = express.Router();

router.post("/contact", sendSupportMessage);

export default router;
