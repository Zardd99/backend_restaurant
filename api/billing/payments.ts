import express from "express";
import { apiLimiter } from "../../middleware/apiLimiter";
import {
  authenticate,
  requirePermission,
  AuthRequest,
} from "../../middleware/auth";
import {
  SplitBillService,
  ProcessPaymentUseCase,
} from "../../services/restaurant_p2_features";
import { MockPaymentGateway } from "../../services/payment/gateway";

const router = express.Router();
const splitBill = new SplitBillService();
const gateway = new MockPaymentGateway();
const processPayment = new ProcessPaymentUseCase(gateway);

router.use(apiLimiter, authenticate);

router.post(
  "/:id/split/even",
  requirePermission("billing:read"),
  async (req, res) => {
    try {
      res.json(await splitBill.evenSplit((req.params.id as string), Number(req.body.ways)));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  },
);

router.post(
  "/:id/split/items",
  requirePermission("billing:read"),
  async (req, res) => {
    try {
      res.json(await splitBill.splitByItems((req.params.id as string), req.body.groups));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  },
);

router.post(
  "/:id/khqr",
  requirePermission("billing:pay"),
  async (req, res) => {
    try {
      res.json(await gateway.generateKHQR(Number(req.body.amount), (req.params.id as string)));
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  },
);

router.post(
  "/:id/pay",
  requirePermission("billing:pay"),
  async (req: AuthRequest, res) => {
    try {
      const result = await processPayment.execute({
        orderId: (req.params.id as string),
        amount: Number(req.body.amount),
        method: req.body.method,
        tipAmount:
          req.body.tipAmount !== undefined
            ? Number(req.body.tipAmount)
            : undefined,
        cardToken: req.body.cardToken,
        referenceId: req.body.referenceId,
        itemIds: req.body.itemIds,
        actor: { id: String(req.user!._id), role: req.user!.role },
      });
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  },
);

export default router;
