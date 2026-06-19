import { Request, Response } from "express";
import Order, { IOrder } from "../models/Order";
import MenuItem from "../models/MenuItem";
import Notification from "../models/Notification";
import { StatsManager } from "../domain/managers/StatsManager";
import { MongoStatsRepository } from "../infrastructure/repositories/MongoStatsRepository";
import { PromotionService } from "../services/PromotionService";
import { tableOccupancyService } from "../services/TableOccupancyService";
import { AuthRequest } from "../middleware/auth";
import { Server as SocketServer } from "socket.io";

// ---------------------------------------------------------------------------
// Notification helpers
// ---------------------------------------------------------------------------

export interface OrderNotificationPayload {
  id: string;
  type: "order_created" | "order_preparing" | "order_ready" | "order_served";
  orderId: string;
  tableNumber?: number;
  customerName?: string;
  itemCount: number;
  actor: { id: string; name: string; role: string };
  timestamp: string;
}

async function emitOrderNotification(
  io: SocketServer,
  payload: OrderNotificationPayload,
): Promise<void> {
  io.emit("order:notification", payload);
  Notification.create({
    type: payload.type,
    orderId: payload.orderId,
    tableNumber: payload.tableNumber,
    customerName: payload.customerName,
    itemCount: payload.itemCount,
    actor: payload.actor,
    timestamp: new Date(payload.timestamp),
  }).catch((err) => console.error("Failed to persist notification:", err));
}

interface FilterConditions {
  status?: string;
  customer?: string;
  customerName?: string;
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
    if (customer) filter.customerName = customer as string;
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

    const orders = await Order.find(filter as any)
      // .populate("customer", "name email")
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
      // .populate("customer", "name email phone")
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
 * - Order items will include promotion pricing (finalPrice, discountAmount, appliedPromotion)

 */
export const createOrder = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    console.log("Creating order with data:", req.body);

    const promotionService = new PromotionService();
    const orderData = { ...req.body };
    let totalDiscountAmount = 0;
    let totalAmount = 0;

    if (req.body.customer) {
      orderData.customerName = req.body.customer;
    }

    delete orderData.customer;

    // Process each order item to apply promotions
    if (
      orderData.items &&
      Array.isArray(orderData.items) &&
      orderData.items.length > 0
    ) {
      const enrichedItems = await Promise.all(
        orderData.items.map(async (item: any) => {
          // Fetch the menu item to get pricing and category info
          const menuItem = await MenuItem.findById(item.menuItem).populate(
            "category",
          );

          if (!menuItem) {
            throw new Error(`Menu item not found: ${item.menuItem}`);
          }

          // Compute best promotion for this menu item
          const appliedPromo =
            await promotionService.computeBestPromotionForMenuItem(menuItem);

          // Calculate final price and discount
          const finalPrice = appliedPromo?.finalPrice ?? menuItem.price;
          const discountAmount = appliedPromo?.discountAmount ?? 0;
          const itemTotalDiscount = discountAmount * item.quantity;

          totalDiscountAmount += itemTotalDiscount;
          totalAmount += finalPrice * item.quantity;

          return {
            ...item,
            originalPrice: menuItem.price,
            finalPrice: finalPrice,
            discountAmount: discountAmount,
            appliedPromotion: appliedPromo?.promotion._id ?? null,
            // Keep the old price field for backward compatibility
            price: item.price ?? menuItem.price,
          };
        }),
      );

      orderData.items = enrichedItems;
      orderData.totalDiscountAmount = totalDiscountAmount;

      // Always set computed total amount based on items and promotions
      orderData.totalAmount = totalAmount;
    }

    // Require at least one item in the order
    if (
      !orderData.items ||
      !Array.isArray(orderData.items) ||
      orderData.items.length === 0
    ) {
      res.status(400).json({ message: "Order must contain at least one item" });
      return;
    }

    // Reject dine-in orders for tables that already have an active order.
    // This is the application-layer guard; the DB index is the final safety net.
    if (orderData.orderType === "dine-in" && orderData.tableNumber != null) {
      const occupied = await tableOccupancyService.isTableOccupied(
        Number(orderData.tableNumber),
      );
      if (occupied) {
        res.status(409).json({
          message: `Table ${orderData.tableNumber} is currently occupied by another order`,
        });
        return;
      }
    }

    const order: IOrder = new Order(orderData);
    const savedOrder = await order.save();

    await savedOrder.populate([
      // { path: "customer", select: "name email" },
      { path: "items.menuItem", select: "name price" },
      {
        path: "items.appliedPromotion",
        select: "name discountType discountValue",
      },
    ]);

    // Emit real-time notification to all connected clients
    const io: SocketServer | undefined = req.app.get("io");
    if (io) {
      const actor = req.user;
      emitOrderNotification(io, {
        id: `${savedOrder._id}-created-${Date.now()}`,
        type: "order_created",
        orderId: savedOrder._id.toString(),
        tableNumber: savedOrder.tableNumber,
        customerName: savedOrder.customerName,
        itemCount: savedOrder.items?.length ?? 0,
        actor: {
          id: actor?._id?.toString() ?? "",
          name: actor?.name ?? "Unknown",
          role: actor?.role ?? "unknown",
        },
        timestamp: new Date().toISOString(),
      });
      // Also broadcast to kitchen for backward compatibility
      io.to("chef").emit("order_created", savedOrder);
    }

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
  req: AuthRequest,
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
      // .populate("customer", "name email")
      .populate("items.menuItem", "name price");

    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    // Emit real-time notification for status transitions that require staff action
    const notifTypeMap: Record<string, OrderNotificationPayload["type"]> = {
      preparing: "order_preparing",
      ready: "order_ready",
      served: "order_served",
    };
    const notifType = notifTypeMap[status];
    const io: SocketServer | undefined = req.app.get("io");
    if (io) {
      if (notifType) {
        const actor = req.user;
        emitOrderNotification(io, {
          id: `${order._id}-${status}-${Date.now()}`,
          type: notifType,
          orderId: order._id.toString(),
          tableNumber: order.tableNumber,
          customerName: order.customerName,
          itemCount: order.items?.length ?? 0,
          actor: {
            id: actor?._id?.toString() ?? "",
            name: actor?.name ?? "Unknown",
            role: actor?.role ?? "unknown",
          },
          timestamp: new Date().toISOString(),
        });
      }
      // Backward-compatible event for waiter interfaces already listening
      io.to("waiter").emit("order_updated", { orderId: order._id, status });
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
    const statsManager = new StatsManager(Order);
    const result = await statsManager.getOrderStats();

    // Type-safe result handling
    if (!result.ok) {
      console.error("StatsManager error:", result.error);
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
      return;
    }

    // Success - return stats
    res.json(result.value);
  } catch (error: any) {
    console.error("Error in getOrderStats controller:", {
      message: error.message,
      stack: error.stack,
    });

    // Fallback: return default values
    res.json({
      dailyEarnings: 0,
      weeklyEarnings: 0,
      yearlyEarnings: 0,
      todayOrderCount: 0,
      avgOrderValue: 0,
      ordersByStatus: {},
      bestSellingDishes: [],
      message: "Statistics loaded with default values due to error",
    });
  }
};
