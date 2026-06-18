"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsManager = void 0;
const Result_1 = require("../../core/Result");
class StatsManager {
    constructor(orderModel) {
        this.orderModel = orderModel;
    }
    async getOrderStats() {
        var _a, _b, _c, _d;
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const startOfWeek = new Date();
            startOfWeek.setDate(startOfWeek.getDate() - 7);
            const startOfYear = new Date(today.getFullYear(), 0, 1);
            const [dailyStats, weeklyStats, yearlyStats, todayStatusStats, allOrders,] = await Promise.all([
                this.orderModel.aggregate([
                    {
                        $match: {
                            orderDate: { $gte: today },
                            status: { $ne: "cancelled" },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            totalEarnings: { $sum: "$totalAmount" },
                            orderCount: { $sum: 1 },
                        },
                    },
                ]),
                this.orderModel.aggregate([
                    {
                        $match: {
                            orderDate: { $gte: startOfWeek },
                            status: { $ne: "cancelled" },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            totalEarnings: { $sum: "$totalAmount" },
                        },
                    },
                ]),
                this.orderModel.aggregate([
                    {
                        $match: {
                            orderDate: { $gte: startOfYear },
                            status: { $ne: "cancelled" },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            totalEarnings: { $sum: "$totalAmount" },
                        },
                    },
                ]),
                this.orderModel.aggregate([
                    {
                        $match: {
                            orderDate: { $gte: today },
                        },
                    },
                    {
                        $group: {
                            _id: "$status",
                            count: { $sum: 1 },
                        },
                    },
                ]),
                this.orderModel
                    .find({
                    status: { $ne: "cancelled" },
                })
                    .populate("items.menuItem"),
            ]);
            const dailyEarnings = ((_a = dailyStats[0]) === null || _a === void 0 ? void 0 : _a.totalEarnings) || 0;
            const todayOrderCount = ((_b = dailyStats[0]) === null || _b === void 0 ? void 0 : _b.orderCount) || 0;
            const weeklyEarnings = ((_c = weeklyStats[0]) === null || _c === void 0 ? void 0 : _c.totalEarnings) || 0;
            const yearlyEarnings = ((_d = yearlyStats[0]) === null || _d === void 0 ? void 0 : _d.totalEarnings) || 0;
            const avgOrderValue = todayOrderCount > 0 ? dailyEarnings / todayOrderCount : 0;
            const ordersByStatus = {};
            todayStatusStats.forEach((stat) => {
                ordersByStatus[stat._id] = stat.count;
            });
            const dishMap = new Map();
            allOrders.forEach((order) => {
                order.items.forEach((item) => {
                    if (item.menuItem) {
                        const key = item.menuItem._id.toString();
                        const existing = dishMap.get(key) || {
                            name: item.menuItem.name,
                            quantity: 0,
                            revenue: 0,
                        };
                        existing.quantity += item.quantity;
                        existing.revenue += item.price * item.quantity;
                        dishMap.set(key, existing);
                    }
                });
            });
            const bestSellingDishes = Array.from(dishMap.values())
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 5);
            const statsData = {
                dailyEarnings,
                weeklyEarnings,
                yearlyEarnings,
                todayOrderCount,
                avgOrderValue,
                ordersByStatus,
                bestSellingDishes,
            };
            return (0, Result_1.Ok)(statsData);
        }
        catch (error) {
            console.error("Error in StatsManager:", error);
            return (0, Result_1.Err)(error instanceof Error ? error.message : "Failed to get order stats");
        }
    }
    calculateTrend(current, previous) {
        if (previous === 0)
            return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    }
}
exports.StatsManager = StatsManager;
//# sourceMappingURL=StatsManager.js.map