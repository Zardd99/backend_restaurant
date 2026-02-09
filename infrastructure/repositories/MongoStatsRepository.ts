import {
  StatsRepository,
  StatsData,
} from "../../domain/repositories/StatsRepository";
import { Result, Ok, Err } from "../../../restaurant_web_app/app/core/Result";
import Order from "../../models/Order";

export class MongoStatsRepository implements StatsRepository {
  async getDailyStats(): Promise<
    Result<{ totalEarnings: number; orderCount: number }, string>
  > {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stats = await Order.aggregate([
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

      return Ok({
        totalEarnings: stats[0]?.totalEarnings || 0,
        orderCount: stats[0]?.orderCount || 0,
      });
    } catch (error) {
      return Err(
        error instanceof Error ? error.message : "Failed to fetch daily stats",
      );
    }
  }

  async getWeeklyStats(): Promise<Result<{ totalEarnings: number }, string>> {
    try {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - 7);

      const stats = await Order.aggregate([
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

      return Ok({
        totalEarnings: stats[0]?.totalEarnings || 0,
      });
    } catch (error) {
      return Err(
        error instanceof Error ? error.message : "Failed to fetch weekly stats",
      );
    }
  }

  async getYearlyStats(): Promise<Result<{ totalEarnings: number }, string>> {
    try {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1);

      const stats = await Order.aggregate([
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

      return Ok({
        totalEarnings: stats[0]?.totalEarnings || 0,
      });
    } catch (error) {
      return Err(
        error instanceof Error ? error.message : "Failed to fetch yearly stats",
      );
    }
  }

  async getTodayStatusStats(): Promise<
    Result<Array<{ _id: string; count: number }>, string>
  > {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stats = await Order.aggregate([
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

      return Ok(stats);
    } catch (error) {
      return Err(
        error instanceof Error
          ? error.message
          : "Failed to fetch today status stats",
      );
    }
  }

  async getBestSellingDishes(): Promise<
    Result<Array<{ name: string; quantity: number; revenue: number }>, string>
  > {
    try {
      const dishes = await Order.aggregate([
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

      return Ok(transformed);
    } catch (error) {
      return Err(
        error instanceof Error
          ? error.message
          : "Failed to fetch best selling dishes",
      );
    }
  }
}
