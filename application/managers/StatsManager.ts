import { Result, Ok, Err } from "../../../restaurant_web_app/app/core/Result";
import { StatsRepository, StatsData } from "../../repositories/StatsRepository";

export class StatsManager {
  constructor(private statsRepo: StatsRepository) {}

  async getOrderStats(): Promise<Result<StatsData, string>> {
    try {
      const [
        dailyResult,
        weeklyResult,
        yearlyResult,
        statusResult,
        bestSellingResult,
      ] = await Promise.all([
        this.statsRepo.getDailyStats(),
        this.statsRepo.getWeeklyStats(),
        this.statsRepo.getYearlyStats(),
        this.statsRepo.getTodayStatusStats(),
        this.statsRepo.getBestSellingDishes(),
      ]);

      // Check for errors
      const errors = [
        dailyResult,
        weeklyResult,
        yearlyResult,
        statusResult,
        bestSellingResult,
      ].filter((result) => !result.ok);

      if (errors.length > 0) {
        return Err(errors.map((e) => e.error).join("; "));
      }

      const dailyStats = dailyResult.value;
      const weeklyStats = weeklyResult.value;
      const yearlyStats = yearlyResult.value;
      const statusStats = statusResult.value;
      const bestSellingDishes = bestSellingResult.value;

      // Convert status stats to object
      const ordersByStatus: Record<string, number> = {};
      statusStats.forEach((stat) => {
        ordersByStatus[stat._id] = stat.count;
      });

      // Calculate average order value
      const avgOrderValue =
        dailyStats.orderCount > 0
          ? dailyStats.totalEarnings / dailyStats.orderCount
          : 0;

      const statsData: StatsData = {
        dailyEarnings: dailyStats.totalEarnings,
        weeklyEarnings: weeklyStats.totalEarnings,
        yearlyEarnings: yearlyStats.totalEarnings,
        todayOrderCount: dailyStats.orderCount,
        avgOrderValue,
        ordersByStatus,
        bestSellingDishes,
      };

      return Ok(statsData);
    } catch (error) {
      return Err(
        error instanceof Error ? error.message : "Failed to get order stats",
      );
    }
  }

  calculateTrend(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }
}
