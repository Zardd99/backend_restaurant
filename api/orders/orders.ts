import express from "express";
import { apiLimiter } from "../../middleware/apiLimiter";
import {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  updateOrderStatus,
  getOrderStats,
} from "../../controllers/orderController";
import { authenticate, requirePermission } from "../../middleware/auth";
import Order from "../../models/Order";

const router = express.Router();

router.use(apiLimiter);

// Debug route — development only, never exposed in production.
if (process.env.NODE_ENV !== "production") {
  router.post("/debug/order", (req, res) => {
    console.log("Received order data:", req.body);
    res.json({ received: true, data: req.body });
  });
}

// Apply authentication to all subsequent routes
router.use(authenticate);

// Permission-based access (see config/rbac.ts)
router.get("/", requirePermission("order:read"), getAllOrders);
router.get("/stats", requirePermission("order:read"), getOrderStats);
router.get("/:id", requirePermission("order:read"), getOrderById);
router.post("/", requirePermission("order:create"), createOrder);
router.put("/:id", requirePermission("order:update"), updateOrder);
router.delete("/:id", requirePermission("order:delete"), deleteOrder);
router.patch(
  "/:id/status",
  requirePermission("order:status"),
  updateOrderStatus,
);

router.post("/:id/inventory", requirePermission("order:update"), async (req, res) => {
  try {
    const { id } = req.params;
    const { deductionStatus, deductionData, warning, timestamp } = req.body;

    const order = await Order.findById(id);
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

    // Emit WebSocket update
    req.app.get("io").emit("order_updated", order);

    res.json({
      success: true,
      message: "Order inventory info updated",
      order,
    });
  } catch (error) {
    console.error("Error updating order inventory info:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
