"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoStatsRepository = void 0;
const Result_1 = require("../../../restaurant_web_app/app/core/Result");
const Order_1 = __importDefault(require("../../models/Order"));
class MongoStatsRepository {
    async getDailyStats() {
        var _a, _b;
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const stats = await Order_1.default.aggregate([
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
            ]);
            return (0, Result_1.Ok)({
                totalEarnings: ((_a = stats[0]) === null || _a === void 0 ? void 0 : _a.totalEarnings) || 0,
                orderCount: ((_b = stats[0]) === null || _b === void 0 ? void 0 : _b.orderCount) || 0,
            });
        }
        catch (error) {
            return (0, Result_1.Err)(error instanceof Error ? error.message : "Failed to fetch daily stats");
        }
    }
    async getWeeklyStats() {
        var _a;
        try {
            const startOfWeek = new Date();
            startOfWeek.setDate(startOfWeek.getDate() - 7);
            const stats = await Order_1.default.aggregate([
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
            ]);
            return (0, Result_1.Ok)({
                totalEarnings: ((_a = stats[0]) === null || _a === void 0 ? void 0 : _a.totalEarnings) || 0,
            });
        }
        catch (error) {
            return (0, Result_1.Err)(error instanceof Error ? error.message : "Failed to fetch weekly stats");
        }
    }
    async getYearlyStats() {
        var _a;
        try {
            const startOfYear = new Date(new Date().getFullYear(), 0, 1);
            const stats = await Order_1.default.aggregate([
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
            ]);
            return (0, Result_1.Ok)({
                totalEarnings: ((_a = stats[0]) === null || _a === void 0 ? void 0 : _a.totalEarnings) || 0,
            });
        }
        catch (error) {
            return (0, Result_1.Err)(error instanceof Error ? error.message : "Failed to fetch yearly stats");
        }
    }
    async getTodayStatusStats() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const stats = await Order_1.default.aggregate([
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
            ]);
            return (0, Result_1.Ok)(stats);
        }
        catch (error) {
            return (0, Result_1.Err)(error instanceof Error
                ? error.message
                : "Failed to fetch today status stats");
        }
    }
    async getBestSellingDishes() {
        try {
            const dishes = await Order_1.default.aggregate([
                { $match: { status: { $ne: "cancelled" } } },
                { $unwind: "$items" },
                {
                    $group: {
                        _id: "$items.menuItem",
                        totalQuantity: { $sum: "$items.quantity" },
                        totalRevenue: {
                            $sum: {
                                $multiply: ["$items.quantity", "$items.price"],
                            },
                        },
                    },
                },
                { $sort: { totalQuantity: -1 } },
                { $limit: 5 },
                {
                    $lookup: {
                        from: "menuitems",
                        localField: "_id",
                        foreignField: "_id",
                        as: "menuItemInfo",
                    },
                },
                {
                    $project: {
                        name: { $arrayElemAt: ["$menuItemInfo.name", 0] },
                        quantity: "$totalQuantity",
                        revenue: "$totalRevenue",
                    },
                },
            ]);
            const transformed = dishes.map((dish) => ({
                name: dish.name || "Unknown Dish",
                quantity: dish.quantity || 0,
                revenue: dish.revenue || 0,
            }));
            return (0, Result_1.Ok)(transformed);
        }
        catch (error) {
            return (0, Result_1.Err)(error instanceof Error
                ? error.message
                : "Failed to fetch best selling dishes");
        }
    }
}
exports.MongoStatsRepository = MongoStatsRepository;
//# sourceMappingURL=MongoStatsRepository.js.map