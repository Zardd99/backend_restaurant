"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const orderController_1 = require("../../controllers/orderController");
const auth_1 = require("../../middleware/auth");
const Order_1 = __importDefault(require("../../models/Order"));
const router = express_1.default.Router();
if (process.env.NODE_ENV !== "production") {
    router.post("/debug/order", (req, res) => {
        console.log("Received order data:", req.body);
        res.json({ received: true, data: req.body });
    });
}
router.use(auth_1.authenticate);
router.get("/", (0, auth_1.requirePermission)("order:read"), orderController_1.getAllOrders);
router.get("/stats", (0, auth_1.requirePermission)("order:read"), orderController_1.getOrderStats);
router.get("/:id", (0, auth_1.requirePermission)("order:read"), orderController_1.getOrderById);
router.post("/", (0, auth_1.requirePermission)("order:create"), orderController_1.createOrder);
router.put("/:id", (0, auth_1.requirePermission)("order:update"), orderController_1.updateOrder);
router.delete("/:id", (0, auth_1.requirePermission)("order:delete"), orderController_1.deleteOrder);
router.patch("/:id/status", (0, auth_1.requirePermission)("order:status"), orderController_1.updateOrderStatus);
router.post("/:id/inventory", (0, auth_1.requirePermission)("order:update"), async (req, res) => {
    try {
        const { id } = req.params;
        const { deductionStatus, deductionData, warning, timestamp } = req.body;
        const order = await Order_1.default.findById(id);
        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }
        order.inventoryDeduction = {
            status: deductionStatus,
            data: deductionData,
            warning,
            timestamp,
            lastUpdated: new Date(),
        };
        await order.save();
        req.app.get("io").emit("order_updated", order);
        res.json({
            success: true,
            message: "Order inventory info updated",
            order,
        });
    }
    catch (error) {
        console.error("Error updating order inventory info:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
//# sourceMappingURL=orders.js.map