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
import { checkoutTableUseCase } from "../../services/table_management_service";
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

      // On full settlement, free the floor: send the dine-in table to "dirty"
      // so it can't be re-seated before bussing. No-op when the order has no
      // table assigned. Side-effect only — never fails the payment response.
      if (result.paymentStatus === "paid") {
        try {
          await checkoutTableUseCase.execute({
            orderId: req.params.id as string,
            actor: { id: String(req.user!._id), role: req.user!.role },
          });
        } catch {
          /* table checkout is best-effort */
        }
      }

      res.json(result);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  },
);

export default router;
