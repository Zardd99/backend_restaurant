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
const inventory_management_service_1 = require("../../services/inventory_management_service");
const router = express_1.default.Router();
router.use(apiLimiter_1.apiLimiter);
router.use(mongoSanitize_1.mongoSanitize);
router.use(auth_1.authenticate);
const writeLimiter = (0, rateLimit_1.rateLimit)({
    tokens: 60,
    window: "1 m",
    prefix: "ims-write",
});
const actorOf = (req) => ({
    id: String(req.user._id),
    role: req.user.role,
});
const fail = (res, error, status = 400) => {
    res.status(status).json({ error: error.message });
};
router.post("/po/:id/receive", writeLimiter, (0, auth_1.requirePermission)("inventory:write"), async (req, res) => {
    var _a;
    try {
        const receivedItems = Array.isArray((_a = req.body) === null || _a === void 0 ? void 0 : _a.receivedItems)
            ? req.body.receivedItems
            : [];
        const result = await inventory_management_service_1.receivePurchaseOrderUseCase.execute(String(req.params.id), receivedItems, actorOf(req));
        res.status(200).json(result);
    }
    catch (error) {
        fail(res, error);
    }
});
router.post("/prep", writeLimiter, (0, auth_1.requirePermission)("inventory:write"), async (req, res) => {
    var _a, _b;
    try {
        const result = await inventory_management_service_1.prepIngredientUseCase.execute(String((_a = req.body) === null || _a === void 0 ? void 0 : _a.preppedIngredientId), Number((_b = req.body) === null || _b === void 0 ? void 0 : _b.quantityToProduce), actorOf(req));
        res.status(201).json(result);
    }
    catch (error) {
        fail(res, error);
    }
});
router.post("/audit", writeLimiter, (0, auth_1.requirePermission)("inventory:write"), async (req, res) => {
    var _a, _b;
    try {
        const items = Array.isArray((_a = req.body) === null || _a === void 0 ? void 0 : _a.items) ? req.body.items : [];
        const result = await inventory_management_service_1.submitInventoryAuditUseCase.execute(String((_b = req.body) === null || _b === void 0 ? void 0 : _b.auditId), items, actorOf(req));
        res.status(200).json(result);
    }
    catch (error) {
        fail(res, error);
    }
});
router.post("/audit/draft", writeLimiter, (0, auth_1.requirePermission)("inventory:write"), async (req, res) => {
    try {
        const result = await inventory_management_service_1.createAuditDraftUseCase.execute(actorOf(req));
        res.status(201).json(result);
    }
    catch (error) {
        fail(res, error);
    }
});
router.get("/audit/sheet", (0, auth_1.requirePermission)("inventory:read"), async (_req, res) => {
    try {
        const rows = await inventory_management_service_1.inventoryAuditQueryService.getCountSheet();
        res.json({ items: rows });
    }
    catch (error) {
        fail(res, error, 500);
    }
});
router.get("/audits", (0, auth_1.requirePermission)("inventory:read"), async (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const audits = await inventory_management_service_1.inventoryAuditQueryService.listAudits(limit);
        res.json({ audits });
    }
    catch (error) {
        fail(res, error, 500);
    }
});
router.get("/audits/:id", (0, auth_1.requirePermission)("inventory:read"), async (req, res) => {
    try {
        const audit = await inventory_management_service_1.inventoryAuditQueryService.getAudit(String(req.params.id));
        res.json(audit);
    }
    catch (error) {
        fail(res, error, 404);
    }
});
router.get("/variance-report", (0, auth_1.requirePermission)("inventory:read"), async (req, res) => {
    try {
        const windowDays = req.query.windowDays
            ? Number(req.query.windowDays)
            : undefined;
        const report = await inventory_management_service_1.inventoryVarianceReportService.getReport(windowDays);
        res.json(report);
    }
    catch (error) {
        fail(res, error, 500);
    }
});
exports.default = router;
//# sourceMappingURL=inventory_routes.js.map