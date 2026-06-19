"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const OrderTimeoutService_1 = require("../../services/OrderTimeoutService");
const router = (0, express_1.Router)();
router.post("/api/order/:orderId/init-prep", async (req, res) => {
    try {
        const { orderId } = req.params;
        const { timeoutMinutes } = req.body;
        const order = await OrderTimeoutService_1.orderTimeoutService.initializePrepTimeout(orderId, timeoutMinutes);
        if (!order) {
            res.status(404).json({ message: "Order not found" });
            return;
        }
        res.json({
            message: "Order prep initialized with timeout",
            order,
        });
    }
    catch (error) {
        res.status(500).json({
            message: "Error initializing prep timeout",
            error: error.message,
        });
    }
});
router.post("/api/order/:orderId/prep-step", async (req, res) => {
    try {
        const { orderId } = req.params;
        const { stepName, status, notes } = req.body;
        if (!stepName || !status) {
            res.status(400).json({
                message: "stepName and status are required",
            });
            return;
        }
        const prepProgress = await OrderTimeoutService_1.orderTimeoutService.updatePrepProgress(orderId, stepName, status, notes);
        res.json({
            message: "Prep step updated",
            prepProgress,
        });
    }
    catch (error) {
        res.status(500).json({
            message: "Error updating prep step",
            error: error.message,
        });
    }
});
router.get("/api/order/:orderId/prep-progress", async (req, res) => {
    try {
        const { orderId } = req.params;
        const prepProgress = await OrderTimeoutService_1.orderTimeoutService.getPrepProgress(orderId);
        if (!prepProgress) {
            res.status(404).json({
                message: "Prep progress not found for this order",
            });
            return;
        }
        res.json(prepProgress);
    }
    catch (error) {
        res.status(500).json({
            message: "Error fetching prep progress",
            error: error.message,
        });
    }
});
router.get("/api/order/:orderId/timeout-status", async (req, res) => {
    try {
        const { orderId } = req.params;
        const status = await OrderTimeoutService_1.orderTimeoutService.getTimeoutStatus(orderId);
        if (!status) {
            res.status(404).json({
                message: "Order not found",
            });
            return;
        }
        res.json(status);
    }
    catch (error) {
        res.status(500).json({
            message: "Error fetching timeout status",
            error: error.message,
        });
    }
});
router.post("/api/order/:orderId/extend-timeout", async (req, res) => {
    try {
        const { orderId } = req.params;
        const { additionalMinutes } = req.body;
        if (!additionalMinutes || additionalMinutes <= 0) {
            res.status(400).json({
                message: "additionalMinutes must be a positive number",
            });
            return;
        }
        const order = await OrderTimeoutService_1.orderTimeoutService.extendTimeout(orderId, additionalMinutes);
        if (!order) {
            res.status(404).json({
                message: "Order not found",
            });
            return;
        }
        res.json({
            message: `Timeout extended by ${additionalMinutes} minutes`,
            order,
        });
    }
    catch (error) {
        res.status(500).json({
            message: "Error extending timeout",
            error: error.message,
        });
    }
});
router.post("/api/order/:orderId/cancel", async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;
        const order = await OrderTimeoutService_1.orderTimeoutService.cancelOrder(orderId, reason || "Manually cancelled by user");
        if (!order) {
            res.status(404).json({
                message: "Order not found",
            });
            return;
        }
        res.json({
            message: "Order cancelled",
            order,
        });
    }
    catch (error) {
        res.status(500).json({
            message: "Error cancelling order",
            error: error.message,
        });
    }
});
router.post("/api/timeout/check-expired", async (req, res) => {
    try {
        const cancelledCount = await OrderTimeoutService_1.orderTimeoutService.checkAndCancelTimedOutOrders();
        const failedSteps = await OrderTimeoutService_1.orderTimeoutService.checkTimedOutPrepSteps();
        res.json({
            message: "Timeout check completed",
            stats: {
                cancelledOrders: cancelledCount,
                failedSteps,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            message: "Error checking timeouts",
            error: error.message,
        });
    }
});
exports.default = router;
//# sourceMappingURL=timeout-router.js.map