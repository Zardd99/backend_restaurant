"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const apiLimiter_1 = require("../../middleware/apiLimiter");
const auth_1 = require("../../middleware/auth");
const restaurant_p2_features_1 = require("../../services/restaurant_p2_features");
const AuditLog_1 = __importDefault(require("../../models/AuditLog"));
const router = express_1.default.Router();
const voidOrder = new restaurant_p2_features_1.VoidOrderUseCase();
const compOrder = new restaurant_p2_features_1.CompOrderUseCase();
router.use(apiLimiter_1.apiLimiter);
router.use(auth_1.authenticate);
router.post("/orders/:id/void", (0, auth_1.requirePermission)("order:void"), async (req, res) => {
    var _a;
    try {
        const reason = req.body.reason;
        if (!restaurant_p2_features_1.VOID_REASONS.includes(reason)) {
            res.status(400).json({ error: "Invalid void reason" });
            return;
        }
        await voidOrder.execute(req.params.id, reason, (_a = req.body.managerId) !== null && _a !== void 0 ? _a : String(req.user._id));
        res.json({ success: true });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.post("/orders/:id/comp", (0, auth_1.requirePermission)("order:comp"), async (req, res) => {
    var _a, _b;
    try {
        await compOrder.execute(req.params.id, String((_a = req.body.reason) !== null && _a !== void 0 ? _a : ""), (_b = req.body.managerId) !== null && _b !== void 0 ? _b : String(req.user._id));
        res.json({ success: true });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.get("/audit", (0, auth_1.requirePermission)("audit:read"), async (req, res) => {
    try {
        const { targetId, action, limit } = req.query;
        const query = {};
        if (targetId)
            query.targetId = String(targetId);
        if (action)
            query.action = String(action);
        const docs = await AuditLog_1.default.find(query)
            .sort({ timestamp: -1 })
            .limit(Math.min(Number(limit) || 100, 500))
            .lean();
        res.json(docs);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=void-comp.js.map