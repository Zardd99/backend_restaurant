"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsManager = void 0;
const Result_1 = require("../../../restaurant_web_app/app/core/Result");
class StatsManager {
    constructor(statsRepo) {
        this.statsRepo = statsRepo;
    }
    async getOrderStats() {
        try {
            const [dailyResult, weeklyResult, yearlyResult, statusResult, bestSellingResult,] = await Promise.all([
                this.statsRepo.getDailyStats(),
                this.statsRepo.getWeeklyStats(),
                this.statsRepo.getYearlyStats(),
                this.statsRepo.getTodayStatusStats(),
                this.statsRepo.getBestSellingDishes(),
            ]);
            const errors = [
                dailyResult,
                weeklyResult,
                yearlyResult,
                statusResult,
                bestSellingResult,
            ].filter((result) => !result.ok);
            if (errors.length > 0) {
                return (0, Result_1.Err)(errors.map((e) => e.error).join("; "));
            }
            const ensureOk = (r) => {
                if (!r.ok)
                    throw new Error(r.error);
                return r.value;
            };
            const dailyStats = ensureOk(dailyResult);
            const weeklyStats = ensureOk(weeklyResult);
            const yearlyStats = ensureOk(yearlyResult);
            const statusStats = ensureOk(statusResult);
            const bestSellingDishes = ensureOk(bestSellingResult);
            const ordersByStatus = {};
            statusStats.forEach((stat) => {
                ordersByStatus[stat._id] = stat.count;
            });
            const avgOrderValue = dailyStats.orderCount > 0
                ? dailyStats.totalEarnings / dailyStats.orderCount
                : 0;
            const statsData = {
                dailyEarnings: dailyStats.totalEarnings,
                weeklyEarnings: weeklyStats.totalEarnings,
                yearlyEarnings: yearlyStats.totalEarnings,
                todayOrderCount: dailyStats.orderCount,
                avgOrderValue,
                ordersByStatus,
                bestSellingDishes,
            };
            return (0, Result_1.Ok)(statsData);
        }
        catch (error) {
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