import { Request, Response } from "express";
import { DependencyContainer } from "../../config/dependencies";
import { InventoryManager } from "../../application/managers/inventory-manager";
import { IngredientRepository } from "../../repositories/ingredient-repository";

export class InventoryAlertController {
  private inventoryManager: InventoryManager;
  private ingredientRepository: IngredientRepository;

  constructor() {
    const container = DependencyContainer.getInstance();
    this.inventoryManager = container.resolve("InventoryManager");
    this.ingredientRepository = container.resolve("IngredientRepository");
  }

  async triggerLowStockCheck(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.inventoryManager.checkAndAlertLowStock();

      if (result.success) {
        res.json({
          success: true,
          message: `Low stock check completed. Found ${result.value.lowStockCount} low stock items.`,
          criticalItems: result.value.criticalStockCount,
          emailsSent: result.value.emailsSent,
          notificationsCreated: result.value.notificationsCreated,
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
        Number(quantity),
      );

      if (result.success) {
        res.json({
          success: true,
          message: "Ingredients consumed successfully",
          consumptionResults: result.value,
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

  // NEW: Get stock levels
  async getStockLevels(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.ingredientRepository.findAll();

      if (!result.success) {
        res.status(500).json({
          success: false,
          message: "Failed to get stock levels",
          error: result.error.message,
        });
        return;
      }

      const ingredients = result.value;
      const stockLevels = ingredients.map((ing) => ({
        id: ing.id,
        name: ing.name,
        currentStock: ing.getStock(),
        minStock: ing.minStock,
        reorderPoint: ing.reorderPoint,
        unit: ing.unit,
        status: ing.getStockLevel(),
        isLowStock: ing.isLowStock(),
        needsReorder: ing.needsReorder(),
      }));

      res.json({
        success: true,
        data: stockLevels,
        summary: {
          total: ingredients.length,
          lowStock: ingredients.filter((i) => i.isLowStock()).length,
          needsReorder: ingredients.filter((i) => i.needsReorder()).length,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // NEW: Get dashboard data
  async getDashboardData(req: Request, res: Response): Promise<void> {
    try {
      // Get stock levels
      const stockResult = await this.ingredientRepository.findAll();

      if (!stockResult.success) {
        res.status(500).json({
          success: false,
          message: "Failed to get dashboard data",
          error: stockResult.error.message,
        });
        return;
      }

      const ingredients = stockResult.value;

      // Calculate statistics
      const criticalItems = ingredients.filter((i) => i.isLowStock());
      const lowItems = ingredients.filter(
        (i) => i.needsReorder() && !i.isLowStock(),
      );
      const normalItems = ingredients.filter((i) => !i.needsReorder());

      // Calculate total inventory value
      const totalValue = ingredients.reduce((sum, ing) => {
        return sum + ing.getStock() * ing.costPerUnit;
      }, 0);

      res.json({
        success: true,
        data: {
          inventory: {
            totalItems: ingredients.length,
            criticalItems: criticalItems.length,
            lowItems: lowItems.length,
            normalItems: normalItems.length,
            totalValue: parseFloat(totalValue.toFixed(2)),
          },
          alerts: {
            enabled: true,
            checkInterval: 60,
            recipientsCount: 2,
          },
          recentActivity: {
            lastCheck: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // NEW: Get recent alerts
  async getRecentAlerts(req: Request, res: Response): Promise<void> {
    try {
      // This would typically come from a notification repository
      const recentAlerts = [
        {
          id: "1",
          ingredientName: "Tomato Sauce",
          message: "Stock is below minimum level",
          level: "critical",
          timestamp: new Date().toISOString(),
          acknowledged: false,
        },
        {
          id: "2",
          ingredientName: "Mozzarella Cheese",
          message: "Stock is approaching reorder point",
          level: "warning",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          acknowledged: true,
        },
      ];

      res.json({
        success: true,
        data: recentAlerts,
        total: recentAlerts.length,
        unacknowledged: recentAlerts.filter((a) => !a.acknowledged).length,
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
