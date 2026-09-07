"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const apiLimiter_1 = require("../../middleware/apiLimiter");
const auth_1 = require("../../middleware/auth");
const restaurant_p2_features_1 = require("../../services/restaurant_p2_features");
const Order_1 = __importDefault(require("../../models/Order"));
const router = express_1.default.Router();
const modifyOrder = new restaurant_p2_features_1.ModifyOrderUseCase();
const toggle86 = new restaurant_p2_features_1.ToggleItemAvailabilityUseCase();
const ITEM_STATUSES = ["pending", "hold", "fired", "served"];
const ALLOWED_ITEM_TRANSITIONS = {
    pending: ["hold", "fired"],
    hold: ["pending", "fired"],
    fired: ["served"],
    served: [],
};
router.use(apiLimiter_1.apiLimiter);
router.use(auth_1.authenticate);
router.patch("/orders/:id/items", (0, auth_1.requirePermission)("order:update"), async (req, res) => {
    try {
        const updated = await modifyOrder.execute(req.params.id, req.body.edits, {
            id: String(req.user._id),
            role: req.user.role,
        });
        res.json(updated);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.patch("/orders/:id/items/:itemId/course", (0, auth_1.requirePermission)("order:status"), async (req, res) => {
    var _a, _b;
    try {
        const next = req.body.status;
        if (!ITEM_STATUSES.includes(next)) {
            res.status(400).json({ error: "Invalid item status" });
            return;
        }
        const order = await Order_1.default.findById(req.params.id);
        if (!order) {
            res.status(404).json({ error: "Order not found" });
            return;
        }
        const item = order.items.id(req.params.itemId);
        if (!item) {
            res.status(404).json({ error: "Order item not found" });
            return;
        }
        const current = ((_a = item.status) !== null && _a !== void 0 ? _a : "pending");
        if (!ALLOWED_ITEM_TRANSITIONS[current].includes(next)) {
            res.status(409).json({ error: `Cannot move item ${current} -> ${next}` });
            return;
        }
        item.status = next;
        await order.save();
        (_b = req.app.get("io")) === null || _b === void 0 ? void 0 : _b.to("chef").emit("order_updated", order);
        res.json({ success: true, item });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.patch("/menu/:id/availability", (0, auth_1.requirePermission)("menu:write"), async (req, res) => {
    try {
        const item = await toggle86.execute(req.params.id, Boolean(req.body.available), { id: String(req.user._id), role: req.user.role });
        res.json(item);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=order-edit.js.map