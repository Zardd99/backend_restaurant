"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const orderController_1 = require("../../controllers/orderController");
const auth_1 = require("../../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticate);
router.post("/debug/order", (req, res) => {
    console.log("Received order data:", req.body);
    console.log("Headers:", req.headers);
    res.json({ received: true, data: req.body });
});
router.get("/", (0, auth_1.authorize)("admin", "manager", "chef", "waiter", "cashier"), orderController_1.getAllOrders);
router.get("/:id", (0, auth_1.authorize)("admin", "manager", "chef", "waiter", "cashier"), orderController_1.getOrderById);
router.post("/", auth_1.authenticate, (0, auth_1.authorize)("admin", "manager", "waiter"), orderController_1.createOrder);
router.put("/:id", (0, auth_1.authorize)("admin", "manager", "waiter"), orderController_1.updateOrder);
router.delete("/:id", (0, auth_1.authorize)("admin", "manager"), orderController_1.deleteOrder);
router.patch("/:id/status", (0, auth_1.authorize)("admin", "manager", "chef", "waiter"), orderController_1.updateOrderStatus);
exports.default = router;
//# sourceMappingURL=orders.js.map