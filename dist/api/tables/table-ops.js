"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const apiLimiter_1 = require("../../middleware/apiLimiter");
const auth_1 = require("../../middleware/auth");
const restaurant_p2_features_1 = require("../../services/restaurant_p2_features");
const router = express_1.default.Router();
const transfer = new restaurant_p2_features_1.TransferTableUseCase();
const merge = new restaurant_p2_features_1.MergeTablesUseCase();
router.use(apiLimiter_1.apiLimiter);
router.use(auth_1.authenticate);
router.post("/tables/transfer", (0, auth_1.requirePermission)("table:manage"), async (req, res) => {
    try {
        const result = await transfer.execute(Number(req.body.fromTable), Number(req.body.toTable), { id: String(req.user._id), role: req.user.role });
        res.json(result);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.post("/tables/merge", (0, auth_1.requirePermission)("table:manage"), async (req, res) => {
    try {
        const result = await merge.execute(Number(req.body.sourceTable), Number(req.body.targetTable), { id: String(req.user._id), role: req.user.role });
        res.json(result);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=table-ops.js.map