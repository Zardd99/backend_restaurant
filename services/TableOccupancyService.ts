import Order from "../models/Order";

/**
 * TableOccupancyService
 * Manages table occupancy tracking and validation for dine-in orders
 */
class TableOccupancyService {
  /**
   * Check if a table is currently occupied (has an active order)
   * @param tableNumber - The table number to check
   * @returns true if table has active order, false otherwise
   */
  async isTableOccupied(tableNumber: number): Promise<boolean> {
    try {
      const activeOrder = await Order.findOne({
        tableNumber,
        status: { $in: ["pending", "confirmed", "preparing", "ready"] },
      });
      return !!activeOrder;
    } catch (error) {
      console.error(`Error checking table ${tableNumber} occupancy:`, error);
      throw error;
    }
  }

  /**
   * Get all currently occupied tables
   * @returns Array of occupied table numbers
   */
  async getOccupiedTables(): Promise<number[]> {
    try {
      const occupiedTables = await Order.aggregate([
        {
          $match: {
            tableNumber: { $exists: true, $ne: null },
            status: { $in: ["pending", "confirmed", "preparing", "ready"] },
          },
        },
        {
          $group: {
            _id: "$tableNumber",
          },
        },
        {
          $sort: { _id: 1 },
        },
        {
          $project: {
            tableNumber: "$_id",
            _id: 0,
          },
        },
      ]);

      return occupiedTables.map((t) => t.tableNumber);
    } catch (error) {
      console.error("Error fetching occupied tables:", error);
      throw error;
    }
  }

  /**
   * Get all available tables (not occupied)
   * @param maxTableNumber - Maximum table number (default 50)
   * @returns Array of available table numbers
   */
  async getAvailableTables(maxTableNumber: number = 50): Promise<number[]> {
    try {
      const occupiedTables = await this.getOccupiedTables();
      const availableTables = [];

      for (let i = 1; i <= maxTableNumber; i++) {
        if (!occupiedTables.includes(i)) {
          availableTables.push(i);
        }
      }

      return availableTables;
    } catch (error) {
      console.error("Error fetching available tables:", error);
      throw error;
    }
  }

  /**
   * Get active order for a specific table
   * @param tableNumber - The table number
   * @returns Active order if exists, null otherwise
   */
  async getTableOrder(tableNumber: number): Promise<any> {
    try {
      const order = await Order.findOne({
        tableNumber,
        status: { $in: ["pending", "confirmed", "preparing", "ready"] },
      }).select("-__v");

      return order;
    } catch (error) {
      console.error(`Error fetching order for table ${tableNumber}:`, error);
      throw error;
    }
  }

  /**
   * Get table occupancy summary
   * @param maxTableNumber - Maximum table number (default 50)
   * @returns Object with occupied/available counts and lists
   */
  async getTableOccupancySummary(maxTableNumber: number = 50): Promise<{
    totalTables: number;
    occupiedCount: number;
    availableCount: number;
    occupiedTables: number[];
    availableTables: number[];
    occupancyRate: number; // percentage
  }> {
    try {
      const occupiedTables = await this.getOccupiedTables();
      const availableTables = await this.getAvailableTables(maxTableNumber);

      return {
        totalTables: maxTableNumber,
        occupiedCount: occupiedTables.length,
        availableCount: availableTables.length,
        occupiedTables: occupiedTables.sort((a, b) => a - b),
        availableTables: availableTables.sort((a, b) => a - b),
        occupancyRate: Math.round(
          (occupiedTables.length / maxTableNumber) * 100,
        ),
      };
    } catch (error) {
      console.error("Error generating table occupancy summary:", error);
      throw error;
    }
  }

  /**
   * Release a table (mark order as served/completed)
   * @param tableNumber - The table number
   * @returns Updated order
   */
  async releaseTable(tableNumber: number): Promise<any> {
    try {
      const order = await Order.findOneAndUpdate(
        {
          tableNumber,
          status: { $in: ["pending", "confirmed", "preparing", "ready"] },
        },
        { status: "served" },
        { new: true },
      );

      if (!order) {
        throw new Error(`No active order found for table ${tableNumber}`);
      }

      console.log(`Table ${tableNumber} released successfully`);
      return order;
    } catch (error) {
      console.error(`Error releasing table ${tableNumber}:`, error);
      throw error;
    }
  }

  /**
   * Get detailed table status with order info
   * @param maxTableNumber - Maximum table number (default 50)
   * @returns Array of table status objects
   */
  async getDetailedTableStatus(maxTableNumber: number = 50): Promise<
    Array<{
      tableNumber: number;
      status: "occupied" | "available";
      orderId?: string;
      orderStatus?: string;
      customerName?: string;
      itemCount?: number;
      totalAmount?: number;
      createdAt?: Date;
    }>
  > {
    try {
      const tableStatuses = [];

      // Get all active orders
      const activeOrders = await Order.find({
        status: { $in: ["pending", "confirmed", "preparing", "ready"] },
        tableNumber: { $exists: true, $ne: null },
      }).select("tableNumber status customerName items totalAmount createdAt");

      // Create map of occupied tables
      const occupiedMap = new Map();
      activeOrders.forEach((order) => {
        occupiedMap.set(order.tableNumber, {
          orderId: order._id.toString(),
          orderStatus: order.status,
          customerName: order.customerName,
          itemCount: order.items?.length || 0,
          totalAmount: order.totalAmount,
          createdAt: order.createdAt,
        });
      });

      // Build detailed status for all tables
      for (let i = 1; i <= maxTableNumber; i++) {
        if (occupiedMap.has(i)) {
          const orderInfo = occupiedMap.get(i);
          tableStatuses.push({
            tableNumber: i,
            status: "occupied",
            ...orderInfo,
          });
        } else {
          tableStatuses.push({
            tableNumber: i,
            status: "available",
          });
        }
      }

      return tableStatuses;
    } catch (error) {
      console.error("Error generating detailed table status:", error);
      throw error;
    }
  }
}

export const tableOccupancyService = new TableOccupancyService();
export default TableOccupancyService;
