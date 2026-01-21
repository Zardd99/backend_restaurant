// backend/api/inventory/inventory-endpoints.ts
/**
 * API Endpoints for Inventory Management
 *
 * Purpose: HTTP interface for ingredient operations
 * Size: < 300 lines
 */

import { Request, Response } from "express";
import { DependencyContainer } from "../config/dependencies";
import { InventoryManager } from "../application/managers/inventory-manager";
import { IngredientRepository } from "../repositories/ingredient-repository";
import { MenuItemRepository } from "../repositories/menu-item-repository";

export class InventoryEndpoints {
  private inventoryManager: InventoryManager;
  private ingredientRepository: IngredientRepository;
  private menuItemRepository: MenuItemRepository;

  constructor() {
    const container = DependencyContainer.getInstance();
    this.inventoryManager = container.resolve("InventoryManager");
    this.ingredientRepository = container.resolve("IngredientRepository");
    this.menuItemRepository = container.resolve("MenuItemRepository");
  }

  /**
   * POST /api/inventory/check-availability
   * Check if ingredients are available for menu items
   */
  async checkAvailability(req: Request, res: Response): Promise<void> {
    try {
      const { items } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          message: "Items array is required",
        });
        return;
      }

      const results = [];

      for (const item of items) {
        const { menuItemId, quantity } = item;

        // Get menu item
        const menuItemResult =
          await this.menuItemRepository.findById(menuItemId);

        if (!menuItemResult.success || !menuItemResult.value) {
          results.push({
            menuItemId,
            menuItemName: "Unknown",
            available: false,
            missingIngredients: ["Menu item not found"],
          });
          continue;
        }

        const menuItem = menuItemResult.value;
        const missingIngredients: string[] = [];

        // Check each required ingredient
        for (const ref of menuItem.getRequiredIngredients()) {
          const ingredientResult = await this.ingredientRepository.findById(
            ref.ingredientId,
          );

          if (!ingredientResult.success || !ingredientResult.value) {
            missingIngredients.push(`Ingredient ${ref.ingredientId} not found`);
            continue;
          }

          const ingredient = ingredientResult.value;
          const requiredAmount = ref.quantity * quantity;

          if (ingredient.getStock() < requiredAmount) {
            missingIngredients.push(
              `${ingredient.name}: Need ${requiredAmount}${ingredient.unit}, have ${ingredient.getStock()}${ingredient.unit}`,
            );
          }
        }

        results.push({
          menuItemId,
          menuItemName: menuItem.name,
          available: missingIngredients.length === 0,
          missingIngredients:
            missingIngredients.length > 0 ? missingIngredients : undefined,
        });
      }

      res.json(results);
    } catch (error) {
      console.error("Error checking availability:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * POST /api/inventory/consume
   * Deduct ingredients for confirmed order
   */
  async consumeIngredients(req: Request, res: Response): Promise<void> {
    try {
      const { items } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          message: "Items array is required",
        });
        return;
      }

      const orderItems = items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
      }));

      const result = await this.inventoryManager.processOrder(orderItems);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error.message,
        });
        return;
      }

      // Format response
      const impacts = result.value.consumedIngredients.map(
        async (consumption) => {
          const ingredientResult = await this.ingredientRepository.findById(
            consumption.ingredientId,
          );

          if (!ingredientResult.success || !ingredientResult.value) {
            return null;
          }

          const ingredient = ingredientResult.value;

          return {
            ingredientId: consumption.ingredientId,
            ingredientName: ingredient.name,
            consumedQuantity: consumption.consumedQuantity,
            remainingStock: consumption.remainingStock,
            unit: ingredient.unit,
            isLowStock: consumption.isLowStock,
            needsReorder: consumption.needsReorder,
          };
        },
      );

      const resolvedImpacts = (await Promise.all(impacts)).filter(Boolean);

      res.json(resolvedImpacts);
    } catch (error) {
      console.error("Error consuming ingredients:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * POST /api/inventory/preview
   * Preview ingredient impact without deducting
   */
  async previewDeduction(req: Request, res: Response): Promise<void> {
    try {
      const { items } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          message: "Items array is required",
        });
        return;
      }

      const previews = [];

      for (const item of items) {
        const { menuItemId, quantity } = item;

        const menuItemResult =
          await this.menuItemRepository.findById(menuItemId);

        if (!menuItemResult.success || !menuItemResult.value) {
          continue;
        }

        const menuItem = menuItemResult.value;

        for (const ref of menuItem.getRequiredIngredients()) {
          const ingredientResult = await this.ingredientRepository.findById(
            ref.ingredientId,
          );

          if (!ingredientResult.success || !ingredientResult.value) {
            continue;
          }

          const ingredient = ingredientResult.value;
          const consumedQuantity = ref.quantity * quantity;
          const remainingStock = ingredient.getStock() - consumedQuantity;

          previews.push({
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            consumedQuantity,
            remainingStock,
            unit: ingredient.unit,
            isLowStock: remainingStock <= ingredient.minStock,
            needsReorder: remainingStock <= ingredient.reorderPoint,
          });
        }
      }

      res.json(previews);
    } catch (error) {
      console.error("Error previewing deduction:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * GET /api/inventory/stock/:ingredientId
   * Get current stock level
   */
  async getStockLevel(req: Request, res: Response): Promise<void> {
    try {
      const { ingredientId } = req.params;

      const result = await this.ingredientRepository.findById(ingredientId);

      if (!result.success || !result.value) {
        res.status(404).json({
          success: false,
          message: "Ingredient not found",
        });
        return;
      }

      res.json({
        stock: result.value.getStock(),
        unit: result.value.unit,
      });
    } catch (error) {
      console.error("Error getting stock level:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * GET /api/inventory/low-stock
   * Get low stock alerts
   */
  async getLowStockAlerts(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.ingredientRepository.findLowStockIngredients();

      if (!result.success) {
        res.status(500).json({
          success: false,
          message: result.error.message,
        });
        return;
      }

      const alerts = result.value.map((ingredient) => ({
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        consumedQuantity: 0,
        remainingStock: ingredient.getStock(),
        unit: ingredient.unit,
        isLowStock: ingredient.isLowStock(),
        needsReorder: ingredient.needsReorder(),
      }));

      res.json(alerts);
    } catch (error) {
      console.error("Error getting low stock alerts:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
