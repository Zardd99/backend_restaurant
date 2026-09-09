"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const apiLimiter_1 = require("../../middleware/apiLimiter");
const auth_1 = require("../../middleware/auth");
const restaurant_p2_features_1 = require("../../services/restaurant_p2_features");
const Shift_1 = __importDefault(require("../../models/Shift"));
const router = express_1.default.Router();
const openShift = new restaurant_p2_features_1.OpenShiftUseCase();
const closeShift = new restaurant_p2_features_1.CloseShiftUseCase();
router.use(apiLimiter_1.apiLimiter);
router.use(auth_1.authenticate);
router.get("/current", (0, auth_1.requirePermission)("billing:read"), async (_req, res) => {
    try {
        res.json(await Shift_1.default.findOne({ status: "open" }).lean());
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post("/open", (0, auth_1.requirePermission)("shift:manage"), async (req, res) => {
    try {
        const shift = await openShift.execute(Number(req.body.startingFloat), {
            id: String(req.user._id),
            role: req.user.role,
        });
        res.json(shift);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.post("/close", (0, auth_1.requirePermission)("shift:manage"), async (req, res) => {
    try {
        const report = await closeShift.execute(Number(req.body.actualCashCounted), { id: String(req.user._id), role: req.user.role });
        res.json(report);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=shifts.js.map