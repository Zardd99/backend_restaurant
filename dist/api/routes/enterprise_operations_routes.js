"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const apiLimiter_1 = require("../../middleware/apiLimiter");
const rateLimit_1 = require("../../middleware/rateLimit");
const mongoSanitize_1 = require("../../middleware/mongoSanitize");
const auth_1 = require("../../middleware/auth");
const KdsTicket_1 = __importDefault(require("../../models/KdsTicket"));
const KdsPacingService_1 = require("../../services/KdsPacingService");
const InventoryYieldService_1 = require("../../services/InventoryYieldService");
const MenuEngineeringService_1 = require("../../services/MenuEngineeringService");
const ClientSyncService_1 = require("../../services/ClientSyncService");
const router = express_1.default.Router();
router.use(apiLimiter_1.apiLimiter);
router.use(mongoSanitize_1.mongoSanitize);
router.use(auth_1.authenticate);
const writeLimiter = (0, rateLimit_1.rateLimit)({ tokens: 60, window: "1 m", prefix: "p3-write" });
const actorOf = (req) => ({
    id: String(req.user._id),
    role: req.user.role,
});
const fail = (res, error, status = 400) => {
    res.status(status).json({ error: error.message });
};
const KDS_STATUSES = [
    "pending",
    "active",
    "completed",
    "expedited",
];
router.get("/kds/tickets", (0, auth_1.requirePermission)("kds:read"), async (req, res) => {
    try {
        const filter = {};
        const status = req.query.status ? String(req.query.status) : undefined;
        if (status) {
            if (!KDS_STATUSES.includes(status)) {
                return fail(res, new Error("Invalid ticket status"));
            }
            filter.ticketStatus = status;
        }
        const tickets = await KdsTicket_1.default.find(filter)
            .sort({ createdAt: 1 })
            .limit(200)
            .lean();
        res.json(tickets);
    }
    catch (error) {
        fail(res, error, 500);
    }
});
router.get("/kds/tickets/:id", (0, auth_1.requirePermission)("kds:read"), async (req, res) => {
    try {
        const ticket = await KdsTicket_1.default.findById(String(req.params.id)).lean();
        if (!ticket)
            return fail(res, new Error("KDS ticket not found"), 404);
        res.json(ticket);
    }
    catch (error) {
        fail(res, error, 500);
    }
});
router.post("/kds/pave", (0, auth_1.requirePermission)("kds:manage"), async (req, res) => {
    var _a;
    try {
        const { orderId, items } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
        const ticket = await KdsPacingService_1.kdsPacingService.paveTicket(String(orderId), Array.isArray(items) ? items : [], actorOf(req));
        res.status(201).json(ticket);
    }
    catch (error) {
        fail(res, error);
    }
});
router.post("/kds/fire-paced", (0, auth_1.requirePermission)("kds:manage"), async (_req, res) => {
    try {
        const fired = await KdsPacingService_1.kdsPacingService.checkAndFirePacedItems();
        res.json({ ticketsFired: fired });
    }
    catch (error) {
        fail(res, error, 500);
    }
});
router.post("/kds/tickets/:id/expedite", (0, auth_1.requirePermission)("kds:manage"), async (req, res) => {
    try {
        const ticket = await KdsPacingService_1.kdsPacingService.expediteTicket(String(req.params.id), actorOf(req));
        res.json(ticket);
    }
    catch (error) {
        fail(res, error);
    }
});
router.patch("/kds/tickets/:id/items/:itemId/complete", (0, auth_1.requirePermission)("kds:manage"), async (req, res) => {
    try {
        const ticket = await KdsPacingService_1.kdsPacingService.markItemCompleted(String(req.params.id), String(req.params.itemId), actorOf(req));
        res.json(ticket);
    }
    catch (error) {
        fail(res, error);
    }
});
router.post("/inventory/batches", writeLimiter, (0, auth_1.requirePermission)("inventory:write"), async (req, res) => {
    var _a;
    try {
        const { ingredientId, quantity, unitCost, expiryDate } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
        await InventoryYieldService_1.inventoryYieldService.receiveBatch({
            ingredientId: String(ingredientId),
            quantity: Number(quantity),
            unitCost: Number(unitCost),
            expiryDate: new Date(expiryDate),
        }, actorOf(req));
        res.status(201).json({ message: "Batch received" });
    }
    catch (error) {
        fail(res, error);
    }
});
router.post("/inventory/waste", writeLimiter, (0, auth_1.requirePermission)("inventory:waste"), async (req, res) => {
    var _a;
    try {
        const { ingredientId, quantity, reason, unit } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
        const wasteLog = await InventoryYieldService_1.inventoryYieldService.logWaste(String(ingredientId), Number(quantity), String(reason), String(req.user._id), String(unit));
        res.status(201).json(wasteLog);
    }
    catch (error) {
        fail(res, error);
    }
});
router.get("/inventory/cogs", (0, auth_1.requirePermission)("analytics:read"), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return fail(res, new Error("startDate and endDate are required"));
        }
        const report = await InventoryYieldService_1.inventoryYieldService.calculateRealCOGS(new Date(String(startDate)), new Date(String(endDate)));
        res.json(report);
    }
    catch (error) {
        fail(res, error);
    }
});
router.get("/menu-engineering", (0, auth_1.requirePermission)("analytics:read"), async (req, res) => {
    try {
        const windowDays = req.query.windowDays
            ? Number(req.query.windowDays)
            : undefined;
        const report = await MenuEngineeringService_1.menuEngineeringService.analyze(windowDays);
        res.json(report);
    }
    catch (error) {
        fail(res, error, 500);
    }
});
router.post("/sync", writeLimiter, (0, auth_1.requirePermission)("sync:write"), async (req, res) => {
    var _a;
    try {
        const { deviceId, queuedTransactions } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
        const outcome = await ClientSyncService_1.clientSyncService.processOfflineSync(String(deviceId), Array.isArray(queuedTransactions) ? queuedTransactions : []);
        res.json(outcome);
    }
    catch (error) {
        fail(res, error);
    }
});
exports.default = router;
//# sourceMappingURL=enterprise_operations_routes.js.map