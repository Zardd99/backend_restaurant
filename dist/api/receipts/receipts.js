"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const receiptController_1 = require("../../controllers/receiptController");
const router = express_1.default.Router();
router.post("/", receiptController_1.createReceipt);
router.get("/", receiptController_1.getAllReceipts);
router.get("/:id", receiptController_1.getReceiptById);
router.get("/order/:orderId", receiptController_1.getReceiptByOrderId);
router.put("/:id", receiptController_1.updateReceipt);
exports.default = router;
//# sourceMappingURL=receipts.js.map