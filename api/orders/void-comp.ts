import express from "express";
import { apiLimiter } from "../../middleware/apiLimiter";
import {
  authenticate,
  requirePermission,
  AuthRequest,
} from "../../middleware/auth";
import {
  VoidOrderUseCase,
  CompOrderUseCase,
  VOID_REASONS,
  VoidReason,
} from "../../services/restaurant_p2_features";
import AuditLog from "../../models/AuditLog";

const router = express.Router();
const voidOrder = new VoidOrderUseCase();
const compOrder = new CompOrderUseCase();

router.use(apiLimiter);
router.use(authenticate);

router.post(
  "/orders/:id/void",
  requirePermission("order:void"),
  async (req: AuthRequest, res) => {
    try {
      const reason = req.body.reason as VoidReason;
      if (!VOID_REASONS.includes(reason)) {
        res.status(400).json({ error: "Invalid void reason" });
        return;
      }
      await voidOrder.execute(
        (req.params.id as string),
        reason,
        req.body.managerId ?? String(req.user!._id),
      );
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  },
);

router.post(
  "/orders/:id/comp",
  requirePermission("order:comp"),
  async (req: AuthRequest, res) => {
    try {
      await compOrder.execute(
        (req.params.id as string),
        String(req.body.reason ?? ""),
        req.body.managerId ?? String(req.user!._id),
      );
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  },
);

router.get("/audit", requirePermission("audit:read"), async (req, res) => {
  try {
    const { targetId, action, limit } = req.query;
    const query: Record<string, unknown> = {};
    if (targetId) query.targetId = targetId;
    if (action) query.action = action;
    const docs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(Math.min(Number(limit) || 100, 500))
      .lean();
    res.json(docs);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
