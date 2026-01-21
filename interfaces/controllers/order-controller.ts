import { Request, Response } from "express";
import { InventoryManager } from "../../application/managers/inventory-manager";
import { DependencyContainer } from "../../config/dependencies";

export class OrderController {
  private inventoryManager: InventoryManager;

  constructor() {
    const container = DependencyContainer.getInstance();
    this.inventoryManager = container.resolve("InventoryManager");
  }

  async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const { items, customerName, customerEmail, notes } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          message: "Order must contain at least one item",
        });
        return;
      }

      // Process order through inventory system
      const inventoryResult = await this.inventoryManager.processOrder(items);

      if (!inventoryResult.success) {
        res.status(400).json({
          success: false,
          message: "Failed to process order",
          error: inventoryResult.error.message,
        });
        return;
      }

      const { successful, consumedIngredients, failedItems } =
        inventoryResult.value;

      if (!successful) {
        res.status(400).json({
          success: false,
          message: "Some items could not be processed",
          failedItems,
          consumedIngredients,
        });
        return;
      }

      // Check for low stock items
      const lowStockItems = consumedIngredients.filter(
        (item) => item.needsReorder,
      );

      // Create order in database (simplified)
      const order = {
        orderNumber: `ORD-${Date.now()}`,
        items,
        customerName,
        customerEmail,
        notes,
        totalAmount: items.reduce(
          (sum: number, item: any) => sum + (item.price || 0),
          0,
        ),
        status: "completed",
        createdAt: new Date(),
      };

      // Save order to database (you would implement this)
      // await Order.create(order);

      res.json({
        success: true,
        message: "Order created successfully",
        order: {
          ...order,
          inventoryConsumed: true,
          lowStockAlerts: lowStockItems.length,
          consumptionResults: consumedIngredients,
        },
      });

      // Log low stock warnings
      if (lowStockItems.length > 0) {
        console.warn(
          `Order triggered low stock for ${lowStockItems.length} ingredients`,
        );
      }
    } catch (error) {
      console.error("Order creation error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async getOrderStatus(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;

      // Fetch order from database (simplified)
      const order = {
        id: orderId,
        status: "completed",
        items: [],
        // ... other order details
      };

      res.json({
        success: true,
        order,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
