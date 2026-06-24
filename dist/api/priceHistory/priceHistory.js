"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const priceHistoryController_1 = require("../../controllers/priceHistoryController");
const auth_1 = require("../../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticate);
router.get("/", (0, auth_1.requirePermission)("price:read"), priceHistoryController_1.getAllPriceHistories);
router.get("/:id", (0, auth_1.requirePermission)("price:read"), priceHistoryController_1.getPriceHistoryById);
exports.default = router;
//# sourceMappingURL=priceHistory.js.map