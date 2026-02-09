import { Result } from "../../core/Result";

export interface StatsData {
  dailyEarnings: number;
  weeklyEarnings: number;
  yearlyEarnings: number;
  todayOrderCount: number;
  avgOrderValue: number;
  ordersByStatus: Record<string, number>;
  bestSellingDishes: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
}

export interface StatsRepository {
  getDailyStats(): Promise<
    Result<{ totalEarnings: number; orderCount: number }, string>
  >;
  getWeeklyStats(): Promise<Result<{ totalEarnings: number }, string>>;
  getYearlyStats(): Promise<Result<{ totalEarnings: number }, string>>;
  getTodayStatusStats(): Promise<
    Result<Array<{ _id: string; count: number }>, string>
  >;
  getBestSellingDishes(): Promise<
    Result<Array<{ name: string; quantity: number; revenue: number }>, string>
  >;
}
