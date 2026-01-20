import { Request, Response } from "express";
import Order, { IOrder } from "../models/Order";

interface FilterConditions {
  status?: string;
  customer?: string;
  orderType?: string;
  orderDate?: {
    $gte?: Date;
    $lte?: Date;
  };
  totalAmount?: {
    $gte?: number;
    $lte?: number;
  };
}

/**
 * GET api/order
 * Retrieve all Order with optional filtering with status, customer, orderType, startDate, endDate, minAmount, maxAmount
 *
 * @param req Express - Request object with query
 * @param res Express - Response object
 *
 * query parameter:
 * - status: filter by status type
 * - customer: filter by customer object
 * - orderType: filter by order types
 * - startDate: filter by start order date
 * - endDate: filter by end date
 * - minAmount: filter by min amount of order's Price
 * - maxAmount: filter by max amount of order's price
 */

export const getAllOrders = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      status,
      customer,
      orderType,
      startDate,
      endDate,
      minAmount,
      maxAmount,
    } = req.query;
    const filter: FilterConditions = {};

    if (status) filter.status = status as string;
    if (customer) filter.customer = customer as string;
    if (orderType) filter.orderType = orderType as string;

    // filter by date
    if (startDate || endDate) {
      filter.orderDate = {};
      if (startDate) filter.orderDate.$gte = new Date(startDate as string);
      if (endDate) filter.orderDate.$lte = new Date(endDate as string);
    }

    // filter by price
    if (minAmount || maxAmount) {
      filter.totalAmount = {};
      if (minAmount) filter.totalAmount.$gte = Number(minAmount);
      if (maxAmount) filter.totalAmount.$lte = Number(maxAmount);
    }

    const orders = await Order.find(filter)
      .populate("customer", "name email")
      .populate("items.menuItem", "name price")
      .sort({ orderDate: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

/**
 * GET api/order/:id
 * Retrieve all Order by id
 *
 * @param req Express - Request object with query
 * @param res Express - Response object

 */
export const getOrderById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customer", "name email phone")
      .populate("items.menuItem", "name price description");

    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

/**
 * POST api/order
 * Create a new Order
 *
 * Request body:
 * - order: Partial order object with fields to create
 *          
 * Response:
 * - Returns created review with populated data

 */
export const createOrder = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    console.log("Creating order with data:", req.body); // Add this for debugging

    const order: IOrder = new Order(req.body);
    const savedOrder = await order.save();

    await savedOrder.populate([
      { path: "customer", select: "name email" },
      { path: "items.menuItem", select: "name price" },
    ]);

    res.status(201).json(savedOrder);
  } catch (error: unknown) {
    console.error("Error creating order:", error);
    res.status(400).json({
      message: "Error creating order",
      error: error instanceof Error ? error.message : String(error),
      details:
        error instanceof Error && "errors" in error ? error.errors : undefined,
    });
  }
};

/**
 * PUT /api/order/:id
 * Updates an existing review with validation
 *
 * URL Parameters:
 * - id: Order ID to update
 *
 * Request Body:
 * - order: Partial order object with fields to update
 *
 * Response: Returns updated order with populated data
 */
export const updateOrder = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("customer", "name email")
      .populate("items.menuItem", "name price");

    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    res.json(order);
  } catch (error) {
    res.status(400).json({ message: "Error updating order", error });
  }
};

/**
 * DELETE /api/order/:id
 * Deletes a order by ID
 *
 * URL Parameters:
 * - id: order ID to delete
 *
 * Response: Returns deleted review data
 */
export const deleteOrder = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);

    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// updateOrderStatus API endpoint
export const updateOrderStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { status } = req.body;
    const validStatuses = [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "served",
      "cancelled",
    ];

    if (!validStatuses.includes(status)) {
      res.status(400).json({
        message: "Invalid status value",
        validStatuses,
      });
      return;
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true },
    )
      .populate("customer", "name email")
      .populate("items.menuItem", "name price");

    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    res.json(order);
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      message: "Error updating order status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * GET /api/orders/stats
 * Get order statistics (earnings, best sellers, etc.)
 */
export const getOrderStats = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    console.log("Fetching order statistics...");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const startOfYear = new Date(today.getFullYear(), 0, 1);

    console.log("Date ranges calculated:", {
      todayStart: today,
      weekStart: startOfWeek,
      yearStart: startOfYear,
    });

    // 1. Get today's earnings and order count
    const todayStatsPromise = Order.aggregate([
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

    // 2. Get weekly earnings
    const weeklyStatsPromise = Order.aggregate([
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

    // 3. Get yearly earnings
    const yearlyStatsPromise = Order.aggregate([
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

    // 4. Get today's orders by status
    const todayStatusStatsPromise = Order.aggregate([
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

    // 5. Get best selling dishes
    const bestSellingPromise = Order.aggregate([
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
          from: "menuitems", // Your collection name
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

    // Run all promises in parallel
    const [
      todayStats,
      weeklyStats,
      yearlyStats,
      todayStatusStats,
      bestSellingDishes,
    ] = await Promise.all([
      todayStatsPromise,
      weeklyStatsPromise,
      yearlyStatsPromise,
      todayStatusStatsPromise,
      bestSellingPromise,
    ]);

    console.log("Aggregation results:", {
      todayStats,
      weeklyStats,
      yearlyStats,
      todayStatusStats,
      bestSellingDishes,
    });

    // Calculate average order value for today
    const todayOrderCount = todayStats[0]?.orderCount || 0;
    const dailyEarnings = todayStats[0]?.totalEarnings || 0;
    const avgOrderValue =
      todayOrderCount > 0 ? dailyEarnings / todayOrderCount : 0;

    // Convert status stats to object
    const ordersByStatus: Record<string, number> = {};
    todayStatusStats.forEach((stat: any) => {
      ordersByStatus[stat._id] = stat.count;
    });

    // Transform best selling dishes
    const transformedBestSellers = bestSellingDishes.map((dish: any) => ({
      name: dish.name || "Unknown Dish",
      quantity: dish.quantity || 0,
      revenue: dish.revenue || 0,
    }));

    // Send response
    const responseData = {
      dailyEarnings,
      weeklyEarnings: weeklyStats[0]?.totalEarnings || 0,
      yearlyEarnings: yearlyStats[0]?.totalEarnings || 0,
      todayOrderCount,
      avgOrderValue,
      ordersByStatus,
      bestSellingDishes: transformedBestSellers,
    };

    console.log("Sending response:", responseData);
    res.json(responseData);
  } catch (error: any) {
    console.error("Error in getOrderStats:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    // Return default values instead of error
    res.json({
      dailyEarnings: 0,
      weeklyEarnings: 0,
      yearlyEarnings: 0,
      todayOrderCount: 0,
      avgOrderValue: 0,
      ordersByStatus: {},
      bestSellingDishes: [],
      message: "Statistics loaded with default values",
    });
  }
};
