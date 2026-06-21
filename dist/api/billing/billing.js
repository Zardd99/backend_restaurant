"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const billingController_1 = require("../../controllers/billingController");
const auth_1 = require("../../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticate);
router.get("/served", (0, auth_1.authorize)("admin", "manager", "cashier", "waiter"), billingController_1.getServedOrders);
router.patch("/:id/pay", (0, auth_1.authorize)("admin", "manager", "cashier", "waiter"), billingController_1.processPayment);
exports.default = router;
//# sourceMappingURL=billing.js.map