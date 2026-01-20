import { Request, Response } from "express";
import { DependencyContainer } from "../../config/dependencies";
import { InventoryManager } from "../../application/managers/inventory-manager";

export class InventoryAlertController {
  private inventoryManager: InventoryManager;

  constructor() {
    const container = DependencyContainer.getInstance();
    this.inventoryManager = container.resolve("InventoryManager");
  }

  async triggerLowStockCheck(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.inventoryManager.checkAndAlertLowStock();

      if (result.success) {
        res.json({
          success: true,
          message: `Low stock check completed. Found ${result.value.lowStockCount} low stock items.`,
          emailsSent: result.value.emailsSent,
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to check low stock",
          error: result.error.message,
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async consumeIngredients(req: Request, res: Response): Promise<void> {
    try {
      const { menuItemId, quantity } = req.body;

      if (!menuItemId || !quantity) {
        res.status(400).json({
          success: false,
          message: "menuItemId and quantity are required",
        });
        return;
      }

      const result = await this.inventoryManager.consumeIngredientsForMenuItem(
        menuItemId,
        quantity,
      );

      if (result.success) {
        res.json({
          success: true,
          message: "Ingredients consumed successfully",
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Failed to consume ingredients",
          error: result.error.message,
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
