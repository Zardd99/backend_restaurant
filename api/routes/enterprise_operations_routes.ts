import express, { Response } from "express";
import { apiLimiter } from "../../middleware/apiLimiter";
import { rateLimit } from "../../middleware/rateLimit";
import { mongoSanitize } from "../../middleware/mongoSanitize";
import {
  authenticate,
  requirePermission,
  AuthRequest,
} from "../../middleware/auth";
import KdsTicket, { KdsTicketStatus } from "../../models/KdsTicket";
import { kdsPacingService } from "../../services/KdsPacingService";
import { inventoryYieldService } from "../../services/InventoryYieldService";
import { menuEngineeringService } from "../../services/MenuEngineeringService";
import { clientSyncService } from "../../services/ClientSyncService";
import { WasteReason } from "../../models/WasteLog";

const router = express.Router();

// CodeQL recognizes the rate limiter only as standalone `router.use()` statements.
// Keep these three as separate lines — never fold them into one combined call.
router.use(apiLimiter);
router.use(mongoSanitize);
router.use(authenticate);

// Stricter distributed limiter for sensitive financial / write-heavy endpoints.
const writeLimiter = rateLimit({ tokens: 60, window: "1 m", prefix: "p3-write" });

const actorOf = (req: AuthRequest) => ({
  id: String(req.user!._id),
  role: req.user!.role,
});

const fail = (res: Response, error: unknown, status = 400): void => {
  res.status(status).json({ error: (error as Error).message });
};

// ---------------------------------------------------------------------------
// Kitchen Display System (KDS) & pacing
// ---------------------------------------------------------------------------

const KDS_STATUSES: KdsTicketStatus[] = [
  "pending",
  "active",
  "completed",
  "expedited",
];

router.get(
  "/kds/tickets",
  requirePermission("kds:read"),
  async (req: AuthRequest, res) => {
    try {
      const filter: Record<string, unknown> = {};
      const status = req.query.status ? String(req.query.status) : undefined;
      if (status) {
        if (!KDS_STATUSES.includes(status as KdsTicketStatus)) {
          return fail(res, new Error("Invalid ticket status"));
        }
        filter.ticketStatus = status;
      }
      const tickets = await KdsTicket.find(filter)
        .sort({ createdAt: 1 })
        .limit(200)
        .lean();
      res.json(tickets);
    } catch (error) {
      fail(res, error, 500);
    }
  },
);

router.get(
  "/kds/tickets/:id",
  requirePermission("kds:read"),
  async (req: AuthRequest, res) => {
    try {
      const ticket = await KdsTicket.findById(String(req.params.id)).lean();
      if (!ticket) return fail(res, new Error("KDS ticket not found"), 404);
      res.json(ticket);
    } catch (error) {
      fail(res, error, 500);
    }
  },
);

router.post(
  "/kds/pave",
  requirePermission("kds:manage"),
  async (req: AuthRequest, res) => {
    try {
      const { orderId, items } = req.body ?? {};
      const ticket = await kdsPacingService.paveTicket(
        String(orderId),
        Array.isArray(items) ? items : [],
        actorOf(req),
      );
      res.status(201).json(ticket);
    } catch (error) {
      fail(res, error);
    }
  },
);

router.post(
  "/kds/fire-paced",
  requirePermission("kds:manage"),
  async (_req: AuthRequest, res) => {
    try {
      const fired = await kdsPacingService.checkAndFirePacedItems();
      res.json({ ticketsFired: fired });
    } catch (error) {
      fail(res, error, 500);
    }
  },
);

router.post(
  "/kds/tickets/:id/expedite",
  requirePermission("kds:manage"),
  async (req: AuthRequest, res) => {
    try {
      const ticket = await kdsPacingService.expediteTicket(
        String(req.params.id),
        actorOf(req),
      );
      res.json(ticket);
    } catch (error) {
      fail(res, error);
    }
  },
);

router.patch(
  "/kds/tickets/:id/items/:itemId/complete",
  requirePermission("kds:manage"),
  async (req: AuthRequest, res) => {
    try {
      const ticket = await kdsPacingService.markItemCompleted(
        String(req.params.id),
        String(req.params.itemId),
        actorOf(req),
      );
      res.json(ticket);
    } catch (error) {
      fail(res, error);
    }
  },
);

// ---------------------------------------------------------------------------
// Supply chain: FIFO batches, waste, COGS
// ---------------------------------------------------------------------------

router.post(
  "/inventory/batches",
  writeLimiter,
  requirePermission("inventory:write"),
  async (req: AuthRequest, res) => {
    try {
      const { ingredientId, quantity, unitCost, expiryDate } = req.body ?? {};
      await inventoryYieldService.receiveBatch(
        {
          ingredientId: String(ingredientId),
          quantity: Number(quantity),
          unitCost: Number(unitCost),
          expiryDate: new Date(expiryDate),
        },
        actorOf(req),
      );
      res.status(201).json({ message: "Batch received" });
    } catch (error) {
      fail(res, error);
    }
  },
);

router.post(
  "/inventory/waste",
  writeLimiter,
  requirePermission("inventory:waste"),
  async (req: AuthRequest, res) => {
    try {
      const { ingredientId, quantity, reason, unit } = req.body ?? {};
      const wasteLog = await inventoryYieldService.logWaste(
        String(ingredientId),
        Number(quantity),
        String(reason) as WasteReason,
        String(req.user!._id),
        String(unit),
      );
      res.status(201).json(wasteLog);
    } catch (error) {
      fail(res, error);
    }
  },
);

router.get(
  "/inventory/cogs",
  requirePermission("analytics:read"),
  async (req: AuthRequest, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return fail(res, new Error("startDate and endDate are required"));
      }
      const report = await inventoryYieldService.calculateRealCOGS(
        new Date(String(startDate)),
        new Date(String(endDate)),
      );
      res.json(report);
    } catch (error) {
      fail(res, error);
    }
  },
);

// ---------------------------------------------------------------------------
// Menu engineering (BCG matrix)
// ---------------------------------------------------------------------------

router.get(
  "/menu-engineering",
  requirePermission("analytics:read"),
  async (req: AuthRequest, res) => {
    try {
      const windowDays = req.query.windowDays
        ? Number(req.query.windowDays)
        : undefined;
      const report = await menuEngineeringService.analyze(windowDays);
      res.json(report);
    } catch (error) {
      fail(res, error, 500);
    }
  },
);

// ---------------------------------------------------------------------------
// Offline-first sync (CRDT / LWW reconciliation)
// ---------------------------------------------------------------------------

router.post(
  "/sync",
  writeLimiter,
  requirePermission("sync:write"),
  async (req: AuthRequest, res) => {
    try {
      const { deviceId, queuedTransactions } = req.body ?? {};
      const outcome = await clientSyncService.processOfflineSync(
        String(deviceId),
        Array.isArray(queuedTransactions) ? queuedTransactions : [],
      );
      res.json(outcome);
    } catch (error) {
      fail(res, error);
    }
  },
);

export default router;
