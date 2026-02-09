import express from "express";
import {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  updateOrderStatus,
  getOrderStats,
} from "../../controllers/orderController";
import { authenticate, authorize } from "../../middleware/auth";
import Order from "../../models/Order";

const router = express.Router();

router.use(authenticate);

router.post("/debug/order", (req, res) => {
  console.log("Received order data:", req.body);
  console.log("Headers:", req.headers);
  res.json({ received: true, data: req.body });
});

// Role-based access
router.get(
  "/",
  authorize("admin", "manager", "chef", "waiter", "cashier"),
  getAllOrders,
);

router.get(
  "/stats",
  authorize("admin", "manager", "chef", "waiter", "cashier"),
  getOrderStats,
);

router.get(
  "/:id",
  authorize("admin", "manager", "chef", "waiter", "cashier"),
  getOrderById,
);

router.post(
  "/",
  authenticate,
  authorize("admin", "manager", "waiter"),
  createOrder,
);
router.put("/:id", authorize("admin", "manager", "waiter"), updateOrder);
router.delete("/:id", authorize("admin", "manager"), deleteOrder);
router.patch(
  "/:id/status",
  authorize("admin", "manager", "chef", "waiter"),
  updateOrderStatus,
);

router.post("/:id/inventory", async (req, res) => {
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
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
