import { Result } from "../core/Result";

export type DailyStats = { totalEarnings: number; orderCount: number };
export type StatusStat = { _id: string; count: number };

export type StatsData = {
  dailyEarnings: number;
  weeklyEarnings: number;
  yearlyEarnings: number;
  todayOrderCount: number;
  avgOrderValue: number;
  ordersByStatus: Record<string, number>;
  bestSellingDishes: any[];
};

export interface StatsRepository {
  getDailyStats(): Promise<Result<DailyStats, string>>;
  getWeeklyStats(): Promise<Result<DailyStats, string>>;
  getYearlyStats(): Promise<Result<DailyStats, string>>;
  getTodayStatusStats(): Promise<Result<StatusStat[], string>>;
  getBestSellingDishes(): Promise<Result<any[], string>>;
}
