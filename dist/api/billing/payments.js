"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const apiLimiter_1 = require("../../middleware/apiLimiter");
const auth_1 = require("../../middleware/auth");
const restaurant_p2_features_1 = require("../../services/restaurant_p2_features");
const table_management_service_1 = require("../../services/table_management_service");
const gateway_1 = require("../../services/payment/gateway");
const router = express_1.default.Router();
const splitBill = new restaurant_p2_features_1.SplitBillService();
const gateway = new gateway_1.MockPaymentGateway();
const processPayment = new restaurant_p2_features_1.ProcessPaymentUseCase(gateway);
router.use(apiLimiter_1.apiLimiter);
router.use(auth_1.authenticate);
router.post("/:id/split/even", (0, auth_1.requirePermission)("billing:read"), async (req, res) => {
    try {
        res.json(await splitBill.evenSplit(req.params.id, Number(req.body.ways)));
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.post("/:id/split/items", (0, auth_1.requirePermission)("billing:read"), async (req, res) => {
    try {
        res.json(await splitBill.splitByItems(req.params.id, req.body.groups));
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.post("/:id/khqr", (0, auth_1.requirePermission)("billing:pay"), async (req, res) => {
    try {
        res.json(await gateway.generateKHQR(Number(req.body.amount), req.params.id));
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.post("/:id/pay", (0, auth_1.requirePermission)("billing:pay"), async (req, res) => {
    try {
        const result = await processPayment.execute({
            orderId: req.params.id,
            amount: Number(req.body.amount),
            method: req.body.method,
            tipAmount: req.body.tipAmount !== undefined
                ? Number(req.body.tipAmount)
                : undefined,
            cardToken: req.body.cardToken,
            referenceId: req.body.referenceId,
            itemIds: req.body.itemIds,
            actor: { id: String(req.user._id), role: req.user.role },
        });
        if (result.paymentStatus === "paid") {
            try {
                await table_management_service_1.checkoutTableUseCase.execute({
                    orderId: req.params.id,
                    actor: { id: String(req.user._id), role: req.user.role },
                });
            }
            catch (_a) {
            }
        }
        res.json(result);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=payments.js.map