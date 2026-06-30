import express, { Response } from "express";
import { apiLimiter } from "../../middleware/apiLimiter";
import { rateLimit } from "../../middleware/rateLimit";
import { mongoSanitize } from "../../middleware/mongoSanitize";
import {
  authenticate,
  requirePermission,
  AuthRequest,
} from "../../middleware/auth";
import {
  receivePurchaseOrderUseCase,
  prepIngredientUseCase,
  submitInventoryAuditUseCase,
  createAuditDraftUseCase,
  inventoryAuditQueryService,
  inventoryVarianceReportService,
} from "../../services/inventory_management_service";

const router = express.Router();

// Keep the rate limiter as standalone `router.use()` statements so CodeQL's
// js/missing-rate-limiting dataflow recognises it (see CLAUDE.md).
router.use(apiLimiter);
router.use(mongoSanitize);
router.use(authenticate);

const writeLimiter = rateLimit({
  tokens: 60,
  window: "1 m",
  prefix: "ims-write",
});

const actorOf = (req: AuthRequest) => ({
  id: String(req.user!._id),
  role: req.user!.role,
});

const fail = (res: Response, error: unknown, status = 400): void => {
  res.status(status).json({ error: (error as Error).message });
};

router.post(
  "/po/:id/receive",
  writeLimiter,
  requirePermission("inventory:write"),
  async (req: AuthRequest, res) => {
    try {
      const receivedItems = Array.isArray(req.body?.receivedItems)
        ? req.body.receivedItems
        : [];
      const result = await receivePurchaseOrderUseCase.execute(
        String(req.params.id),
        receivedItems,
        actorOf(req),
      );
      res.status(200).json(result);
    } catch (error) {
      fail(res, error);
    }
  },
);

router.post(
  "/prep",
  writeLimiter,
  requirePermission("inventory:write"),
  async (req: AuthRequest, res) => {
    try {
      const result = await prepIngredientUseCase.execute(
        String(req.body?.preppedIngredientId),
        Number(req.body?.quantityToProduce),
        actorOf(req),
      );
      res.status(201).json(result);
    } catch (error) {
      fail(res, error);
    }
  },
);

router.post(
  "/audit",
  writeLimiter,
  requirePermission("inventory:write"),
  async (req: AuthRequest, res) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      const result = await submitInventoryAuditUseCase.execute(
        String(req.body?.auditId),
        items,
        actorOf(req),
      );
      res.status(200).json(result);
    } catch (error) {
      fail(res, error);
    }
  },
);

router.post(
  "/audit/draft",
  writeLimiter,
  requirePermission("inventory:write"),
  async (req: AuthRequest, res) => {
    try {
      const result = await createAuditDraftUseCase.execute(actorOf(req));
      res.status(201).json(result);
    } catch (error) {
      fail(res, error);
    }
  },
);

router.get(
  "/audit/sheet",
  requirePermission("inventory:read"),
  async (_req: AuthRequest, res) => {
    try {
      const rows = await inventoryAuditQueryService.getCountSheet();
      res.json({ items: rows });
    } catch (error) {
      fail(res, error, 500);
    }
  },
);

router.get(
  "/audits",
  requirePermission("inventory:read"),
  async (req: AuthRequest, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const audits = await inventoryAuditQueryService.listAudits(limit);
      res.json({ audits });
    } catch (error) {
      fail(res, error, 500);
    }
  },
);

router.get(
  "/audits/:id",
  requirePermission("inventory:read"),
  async (req: AuthRequest, res) => {
    try {
      const audit = await inventoryAuditQueryService.getAudit(
        String(req.params.id),
      );
      res.json(audit);
    } catch (error) {
      fail(res, error, 404);
    }
  },
);

router.get(
  "/variance-report",
  requirePermission("inventory:read"),
  async (req: AuthRequest, res) => {
    try {
      const windowDays = req.query.windowDays
        ? Number(req.query.windowDays)
        : undefined;
      const report = await inventoryVarianceReportService.getReport(windowDays);
      res.json(report);
    } catch (error) {
      fail(res, error, 500);
    }
  },
);

export default router;
