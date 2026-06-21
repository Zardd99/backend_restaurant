"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const receiptController_1 = require("../../controllers/receiptController");
const auth_1 = require("../../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticate);
router.get("/", (0, auth_1.authorize)("admin", "manager"), receiptController_1.getAllReceipts);
router.get("/order/:orderId", (0, auth_1.authorize)("admin", "manager", "cashier"), receiptController_1.getReceiptByOrderId);
router.get("/:id", (0, auth_1.authorize)("admin", "manager", "cashier"), receiptController_1.getReceiptById);
router.post("/", (0, auth_1.authorize)("admin", "manager", "cashier"), receiptController_1.createReceipt);
router.put("/:id", (0, auth_1.authorize)("admin", "manager"), receiptController_1.updateReceipt);
exports.default = router;
//# sourceMappingURL=receipts.js.map