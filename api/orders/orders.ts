import express from "express";
import {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  updateOrderStatus,
} from "../../controllers/orderController";
import { authenticate, authorize } from "../../middleware/auth";

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
  getAllOrders
);
router.get(
  "/:id",
  authorize("admin", "manager", "chef", "waiter", "cashier"),
  getOrderById
);
router.post(
  "/",
  authenticate,
  authorize("admin", "manager", "waiter"),
  createOrder
);
router.put("/:id", authorize("admin", "manager", "waiter"), updateOrder);
router.delete("/:id", authorize("admin", "manager"), deleteOrder);
router.patch(
  "/:id/status",
  authorize("admin", "manager", "chef", "waiter"),
  updateOrderStatus
);

export default router;
