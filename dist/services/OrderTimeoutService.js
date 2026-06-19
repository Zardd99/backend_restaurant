"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderTimeoutService = exports.OrderTimeoutService = void 0;
const Order_1 = __importDefault(require("../models/Order"));
const ChefPrepProgress_1 = __importDefault(require("../models/ChefPrepProgress"));
const mongoose_1 = require("mongoose");
class OrderTimeoutService {
    constructor(config = {}) {
        this.defaultPrepTimeoutMinutes = config.defaultPrepTimeoutMinutes || 30;
        this.checkIntervalSeconds = config.checkIntervalSeconds || 60;
        this.enableAutoCancel = config.enableAutoCancel !== false;
    }
    async initializePrepTimeout(orderId, timeoutMinutes) {
        try {
            const order = await Order_1.default.findById(orderId);
            if (!order) {
                throw new Error(`Order ${orderId} not found`);
            }
            const timeoutMins = timeoutMinutes || this.defaultPrepTimeoutMinutes;
            const now = new Date();
            const timeoutAt = new Date(now.getTime() + timeoutMins * 60000);
            const updatedOrder = await Order_1.default.findByIdAndUpdate(orderId, {
                status: "preparing",
                totalPrepTimeoutMinutes: timeoutMins,
                prepStartedAt: now,
                prepTimeoutAt: timeoutAt,
                lastPrepUpdateAt: now,
            }, { new: true });
            console.log(`Order ${orderId} prep initialized with ${timeoutMins} minutes timeout`);
            return updatedOrder;
        }
        catch (error) {
            console.error(`Error initializing prep timeout for order ${orderId}:`, error);
            throw error;
        }
    }
    async updatePrepProgress(orderId, stepName, status, notes) {
        try {
            let prepProgress = await ChefPrepProgress_1.default.findOne({
                orderId: new mongoose_1.Types.ObjectId(orderId),
            });
            if (!prepProgress) {
                const order = await Order_1.default.findById(orderId);
                if (!order) {
                    throw new Error(`Order ${orderId} not found`);
                }
                prepProgress = new ChefPrepProgress_1.default({
                    orderId: new mongoose_1.Types.ObjectId(orderId),
                    totalEstimatedMinutes: order.totalPrepTimeoutMinutes || 30,
                    overallStatus: "in-progress",
                    steps: [],
                });
            }
            const existingStep = prepProgress.steps.find((s) => s.stepName === stepName);
            const now = new Date();
            if (existingStep) {
                existingStep.status = status;
                if (status === "in-progress" && !existingStep.startedAt) {
                    existingStep.startedAt = now;
                    existingStep.timeoutAt = new Date(now.getTime() + existingStep.estimatedDurationMinutes * 60000);
                }
                else if (status === "completed") {
                    existingStep.completedAt = now;
                }
                if (notes) {
                    existingStep.notes = notes;
                }
            }
            else {
                prepProgress.steps.push({
                    stepName: stepName,
                    estimatedDurationMinutes: 10,
                    status: status,
                    startedAt: status === "in-progress" ? now : undefined,
                    completedAt: status === "completed" ? now : undefined,
                    timeoutAt: new Date(now.getTime() + 10 * 60000),
                    notes,
                });
            }
            const allCompleted = prepProgress.steps.every((s) => s.status === "completed" || s.status === "skipped");
            if (allCompleted) {
                prepProgress.overallStatus = "completed";
                prepProgress.completedAt = now;
            }
            else if (prepProgress.steps.some((s) => s.status === "in-progress")) {
                prepProgress.overallStatus = "in-progress";
                prepProgress.startedAt = prepProgress.startedAt || now;
            }
            await prepProgress.save();
            await Order_1.default.findByIdAndUpdate(orderId, {
                lastPrepUpdateAt: now,
            }, { new: true });
            console.log(`Prep progress updated for order ${orderId}: ${stepName} - ${status}`);
            return prepProgress;
        }
        catch (error) {
            console.error(`Error updating prep progress for order ${orderId}:`, error);
            throw error;
        }
    }
    async getPrepProgress(orderId) {
        try {
            return await ChefPrepProgress_1.default.findOne({
                orderId: new mongoose_1.Types.ObjectId(orderId),
            });
        }
        catch (error) {
            console.error(`Error getting prep progress for order ${orderId}:`, error);
            throw error;
        }
    }
    async checkAndCancelTimedOutOrders() {
        try {
            const now = new Date();
            const timedOutOrders = await Order_1.default.find({
                status: "preparing",
                prepTimeoutAt: { $lt: now },
                autoCancel: true,
            });
            let cancelledCount = 0;
            for (const order of timedOutOrders) {
                await this.cancelOrder(order._id.toString(), "Preparation timeout - no updates for the specified period");
                cancelledCount++;
            }
            if (cancelledCount > 0) {
                console.log(`Auto-cancelled ${cancelledCount} orders due to timeout`);
            }
            return cancelledCount;
        }
        catch (error) {
            console.error("Error checking for timed out orders:", error);
            return 0;
        }
    }
    async checkTimedOutPrepSteps() {
        try {
            const now = new Date();
            const prepProgressList = await ChefPrepProgress_1.default.find({
                overallStatus: { $in: ["pending", "in-progress"] },
                "steps.status": "in-progress",
                "steps.timeoutAt": { $lt: now },
            });
            let timedOutCount = 0;
            for (const prep of prepProgressList) {
                const timedOutSteps = prep.steps.filter((s) => s.status === "in-progress" && s.timeoutAt && s.timeoutAt < now);
                for (const step of timedOutSteps) {
                    step.status = "failed";
                    step.notes = (step.notes || "") + " [TIMEOUT]";
                    timedOutCount++;
                }
                if (timedOutSteps.length > 0) {
                    await prep.save();
                    console.log(`Marked ${timedOutSteps.length} timed out steps as failed for order ${prep.orderId}`);
                }
            }
            return timedOutCount;
        }
        catch (error) {
            console.error("Error checking for timed out prep steps:", error);
            return 0;
        }
    }
    async cancelOrder(orderId, reason) {
        try {
            const updatedOrder = await Order_1.default.findByIdAndUpdate(orderId, {
                status: "cancelled",
                cancelledReason: reason,
            }, { new: true });
            const prepProgress = await ChefPrepProgress_1.default.findOneAndUpdate({ orderId: new mongoose_1.Types.ObjectId(orderId) }, {
                overallStatus: "cancelled",
                cancelledAt: new Date(),
                cancelReason: reason,
            }, { new: true });
            console.log(`Order ${orderId} cancelled: ${reason}`);
            return updatedOrder;
        }
        catch (error) {
            console.error(`Error cancelling order ${orderId}:`, error);
            throw error;
        }
    }
    async extendTimeout(orderId, additionalMinutes) {
        try {
            const order = await Order_1.default.findById(orderId);
            if (!order || !order.prepTimeoutAt) {
                throw new Error(`Order ${orderId} not found or prep not started`);
            }
            const newTimeoutAt = new Date(order.prepTimeoutAt.getTime() + additionalMinutes * 60000);
            const updatedOrder = await Order_1.default.findByIdAndUpdate(orderId, {
                prepTimeoutAt: newTimeoutAt,
                lastPrepUpdateAt: new Date(),
            }, { new: true });
            console.log(`Order ${orderId} timeout extended by ${additionalMinutes} minutes`);
            return updatedOrder;
        }
        catch (error) {
            console.error(`Error extending timeout for order ${orderId}:`, error);
            throw error;
        }
    }
    async getTimeoutStatus(orderId) {
        try {
            const order = await Order_1.default.findById(orderId);
            if (!order) {
                return null;
            }
            const prepProgress = await ChefPrepProgress_1.default.findOne({
                orderId: new mongoose_1.Types.ObjectId(orderId),
            });
            const now = new Date();
            const isExpired = order.prepTimeoutAt != null && order.prepTimeoutAt < now;
            const timeoutInMinutes = order.prepTimeoutAt
                ? Math.round((order.prepTimeoutAt.getTime() - now.getTime()) / 60000)
                : undefined;
            return {
                orderId: order._id.toString(),
                status: order.status,
                timeoutAt: order.prepTimeoutAt,
                timeoutInMinutes: timeoutInMinutes != null && timeoutInMinutes > 0
                    ? timeoutInMinutes
                    : 0,
                isExpired,
                prepSteps: prepProgress === null || prepProgress === void 0 ? void 0 : prepProgress.steps.map((s) => ({
                    name: s.stepName,
                    status: s.status,
                    timeoutAt: s.timeoutAt,
                    isExpired: s.timeoutAt != null && s.timeoutAt < now,
                })),
            };
        }
        catch (error) {
            console.error(`Error getting timeout status for order ${orderId}:`, error);
            throw error;
        }
    }
    startTimeoutChecker() {
        if (this.checkInterval) {
            console.log("Timeout checker already running");
            return;
        }
        this.checkInterval = setInterval(async () => {
            try {
                const cancelledCount = await this.checkAndCancelTimedOutOrders();
                const failedSteps = await this.checkTimedOutPrepSteps();
                if (cancelledCount > 0 || failedSteps > 0) {
                    console.log(`Timeout check: Cancelled ${cancelledCount} orders, Failed ${failedSteps} steps`);
                }
            }
            catch (error) {
                console.error("Error in timeout checker:", error);
            }
        }, this.checkIntervalSeconds * 1000);
        console.log(`Timeout checker started (interval: ${this.checkIntervalSeconds}s)`);
    }
    stopTimeoutChecker() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = undefined;
            console.log("Timeout checker stopped");
        }
    }
}
exports.OrderTimeoutService = OrderTimeoutService;
exports.orderTimeoutService = new OrderTimeoutService({
    defaultPrepTimeoutMinutes: 30,
    checkIntervalSeconds: 60,
    enableAutoCancel: true,
});
//# sourceMappingURL=OrderTimeoutService.js.map