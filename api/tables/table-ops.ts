import express from "express";
import { apiLimiter } from "../../middleware/apiLimiter";
import {
  authenticate,
  requirePermission,
  AuthRequest,
} from "../../middleware/auth";
import {
  TransferTableUseCase,
  MergeTablesUseCase,
} from "../../services/restaurant_p2_features";

const router = express.Router();
const transfer = new TransferTableUseCase();
const merge = new MergeTablesUseCase();

router.use(apiLimiter);
router.use(authenticate);

router.post(
  "/tables/transfer",
  requirePermission("table:manage"),
  async (req: AuthRequest, res) => {
    try {
      const result = await transfer.execute(
        Number(req.body.fromTable),
        Number(req.body.toTable),
        { id: String(req.user!._id), role: req.user!.role },
      );
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  },
);

router.post(
  "/tables/merge",
  requirePermission("table:manage"),
  async (req: AuthRequest, res) => {
    try {
      const result = await merge.execute(
        Number(req.body.sourceTable),
        Number(req.body.targetTable),
        { id: String(req.user!._id), role: req.user!.role },
      );
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  },
);

export default router;
