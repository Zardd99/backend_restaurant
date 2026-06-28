import express from "express";
import { apiLimiter } from "../../middleware/apiLimiter";
import {
  authenticate,
  requirePermission,
  AuthRequest,
} from "../../middleware/auth";
import {
  OpenShiftUseCase,
  CloseShiftUseCase,
} from "../../services/restaurant_p2_features";
import Shift from "../../models/Shift";

const router = express.Router();
const openShift = new OpenShiftUseCase();
const closeShift = new CloseShiftUseCase();

router.use(apiLimiter, authenticate);

router.get("/current", requirePermission("billing:read"), async (_req, res) => {
  try {
    res.json(await Shift.findOne({ status: "open" }).lean());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post(
  "/open",
  requirePermission("shift:manage"),
  async (req: AuthRequest, res) => {
    try {
      const shift = await openShift.execute(Number(req.body.startingFloat), {
        id: String(req.user!._id),
        role: req.user!.role,
      });
      res.json(shift);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  },
);

router.post(
  "/close",
  requirePermission("shift:manage"),
  async (req: AuthRequest, res) => {
    try {
      const report = await closeShift.execute(
        Number(req.body.actualCashCounted),
        { id: String(req.user!._id), role: req.user!.role },
      );
      res.json(report);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  },
);

export default router;
