import express from "express";
import { apiLimiter } from "../../middleware/apiLimiter";
import {
  authenticate,
  requirePermission,
  AuthRequest,
} from "../../middleware/auth";
import {
  ModifyOrderUseCase,
  ToggleItemAvailabilityUseCase,
} from "../../services/restaurant_p2_features";
import Order from "../../models/Order";

const router = express.Router();
const modifyOrder = new ModifyOrderUseCase();
const toggle86 = new ToggleItemAvailabilityUseCase();

const ITEM_STATUSES = ["pending", "hold", "fired", "served"] as const;
type ItemStatus = (typeof ITEM_STATUSES)[number];

const ALLOWED_ITEM_TRANSITIONS: Record<ItemStatus, ItemStatus[]> = {
  pending: ["hold", "fired"],
  hold: ["pending", "fired"],
  fired: ["served"],
  served: [],
};

router.use(apiLimiter, authenticate);

router.patch(
  "/orders/:id/items",
  requirePermission("order:update"),
  async (req: AuthRequest, res) => {
    try {
      const updated = await modifyOrder.execute((req.params.id as string), req.body.edits, {
        id: String(req.user!._id),
        role: req.user!.role,
      });
      res.json(updated);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  },
);

router.patch(
  "/orders/:id/items/:itemId/course",
  requirePermission("order:status"),
  async (req: AuthRequest, res) => {
    try {
      const next = req.body.status as ItemStatus;
      if (!ITEM_STATUSES.includes(next)) {
        res.status(400).json({ error: "Invalid item status" });
        return;
      }
      const order = await Order.findById((req.params.id as string));
      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }
      const item = (order.items as unknown as {
        id: (id: string) => { status?: ItemStatus } | null;
      }).id((req.params.itemId as string));
      if (!item) {
        res.status(404).json({ error: "Order item not found" });
        return;
      }
      const current = (item.status ?? "pending") as ItemStatus;
      if (!ALLOWED_ITEM_TRANSITIONS[current].includes(next)) {
        res.status(409).json({ error: `Cannot move item ${current} -> ${next}` });
        return;
      }
      item.status = next;
      await order.save();
      req.app.get("io")?.to("chef").emit("order_updated", order);
      res.json({ success: true, item });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  },
);

router.patch(
  "/menu/:id/availability",
  requirePermission("menu:write"),
  async (req: AuthRequest, res) => {
    try {
      const item = await toggle86.execute(
        (req.params.id as string),
        Boolean(req.body.available),
        { id: String(req.user!._id), role: req.user!.role },
      );
      res.json(item);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  },
);

export default router;
