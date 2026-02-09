import { Result, Ok, Err } from "../../core/Result";

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

export class StatsManager {
  constructor(private orderModel: any) {}

  async getOrderStats(): Promise<Result<StatsData, string>> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - 7);

      const startOfYear = new Date(today.getFullYear(), 0, 1);

      // Get all stats in parallel
      const [
        dailyStats,
        weeklyStats,
        yearlyStats,
        todayStatusStats,
        allOrders,
      ] = await Promise.all([
        // Daily earnings and count
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

        // Weekly earnings
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

        // Yearly earnings
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

        // Today's orders by status
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

        // All non-cancelled orders for best sellers
        this.orderModel
          .find({
            status: { $ne: "cancelled" },
          })
          .populate("items.menuItem"),
      ]);

      // Extract values
      const dailyEarnings = dailyStats[0]?.totalEarnings || 0;
      const todayOrderCount = dailyStats[0]?.orderCount || 0;
      const weeklyEarnings = weeklyStats[0]?.totalEarnings || 0;
      const yearlyEarnings = yearlyStats[0]?.totalEarnings || 0;
      const avgOrderValue =
        todayOrderCount > 0 ? dailyEarnings / todayOrderCount : 0;

      // Convert status stats to object
      const ordersByStatus: Record<string, number> = {};
      todayStatusStats.forEach((stat: any) => {
        ordersByStatus[stat._id] = stat.count;
      });

      // Calculate best selling dishes
      const dishMap = new Map();
      allOrders.forEach((order: any) => {
        order.items.forEach((item: any) => {
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

      const statsData: StatsData = {
        dailyEarnings,
        weeklyEarnings,
        yearlyEarnings,
        todayOrderCount,
        avgOrderValue,
        ordersByStatus,
        bestSellingDishes,
      };

      return Ok(statsData);
    } catch (error) {
      console.error("Error in StatsManager:", error);
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
