/**
 * API Endpoints for Inventory Management
 *
 * Purpose: HTTP interface for ingredient operations
 * Size: < 300 lines
 */

import { ok, err } from "../shared/result";

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

  private async getDependencies() {
    if (
      !this.inventoryManager ||
      !this.ingredientRepository ||
      !this.menuItemRepository
    ) {
      const container = DependencyContainer.getInstance();
      this.inventoryManager = container.resolve("InventoryManager");
      this.ingredientRepository = container.resolve("IngredientRepository");
      this.menuItemRepository = container.resolve("MenuItemRepository");
    }
    return {
      inventoryManager: this.inventoryManager!,
      ingredientRepository: this.ingredientRepository!,
      menuItemRepository: this.menuItemRepository!,
    };
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

      const { menuItemRepository, ingredientRepository } =
        await this.getDependencies();

      const results = [];

      for (const item of items) {
        const { menuItemId, quantity } = item;

        const menuItemResult = await menuItemRepository.findById(menuItemId);

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

        for (const ref of menuItem.getRequiredIngredients()) {
          const ingredientResult = await ingredientRepository.findById(
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

      res.json(ok(results));
    } catch (error) {
      console.error("Error checking availability:", error);
      res.status(500).json({ message: "Server error", error });
    }
  }
  // Update consumeIngredients to match DeductionResult format:
  async consumeIngredients(req: Request, res: Response): Promise<void> {
    try {
      const { requests } = req.body;
      const { inventoryManager, ingredientRepository, menuItemRepository } =
        await this.getDependencies();

      if (!Array.isArray(requests) || requests.length === 0) {
        res.status(400).json({
          ok: false,
          error: "Requests array is required",
        });
        return;
      }

      // First, aggregate all ingredient requirements
      const ingredientRequirements = new Map<string, number>();

      for (const req of requests) {
        const { menuItemId, quantity } = req;

        const menuItemResult = await menuItemRepository.findById(menuItemId);

        if (!menuItemResult.success || !menuItemResult.value) {
          continue;
        }

        const menuItem = menuItemResult.value;

        for (const ref of menuItem.getRequiredIngredients()) {
          const currentRequirement =
            ingredientRequirements.get(ref.ingredientId) || 0;
          ingredientRequirements.set(
            ref.ingredientId,
            currentRequirement + ref.quantity * quantity,
          );
        }
      }

      // Convert to items format for InventoryManager (aggregated)
      const items = Array.from(ingredientRequirements.entries()).map(
        ([ingredientId, totalRequired]) => ({
          ingredientId,
          quantity: totalRequired,
        }),
      );

      // Note: You might need to adjust your InventoryManager to handle direct ingredient deductions
      // If your InventoryManager expects menu items, you'll need a different approach

      // Alternative: Process each request individually but aggregate results
      const allDeductionResults: any[] = [];

      for (const req of requests) {
        const items = [{ menuItemId: req.menuItemId, quantity: req.quantity }];
        const result = await inventoryManager.processOrder(items);

        if (!result.success) {
          continue;
        }

        for (const consumption of result.value.consumedIngredients) {
          const ingredientResult = await ingredientRepository.findById(
            consumption.ingredientId,
          );

          if (ingredientResult.success && ingredientResult.value) {
            const ingredient = ingredientResult.value;

            // Check if we already have this ingredient in results
            const existingIndex = allDeductionResults.findIndex(
              (r) => r.ingredientId === consumption.ingredientId,
            );

            if (existingIndex >= 0) {
              // Sum with existing
              allDeductionResults[existingIndex].consumedQuantity +=
                consumption.consumedQuantity;
              allDeductionResults[existingIndex].remainingStock =
                ingredient.getStock();
            } else {
              // Add new entry
              allDeductionResults.push({
                ingredientId: consumption.ingredientId,
                ingredientName: ingredient.name,
                consumedQuantity: consumption.consumedQuantity,
                remainingStock: consumption.remainingStock,
                unit: ingredient.unit,
                isLowStock: consumption.isLowStock,
                needsReorder: consumption.needsReorder,
                reorderPoint: ingredient.reorderPoint,
              });
            }
          }
        }
      }

      res.json({
        ok: true,
        value: allDeductionResults,
      });
    } catch (error) {
      console.error("Error consuming ingredients:", error);
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Server error",
      });
    }
  }

  // Update previewDeduction method:
  async previewDeduction(req: Request, res: Response): Promise<void> {
    try {
      const { requests } = req.body;
      const { menuItemRepository, ingredientRepository } =
        await this.getDependencies();

      if (!Array.isArray(requests) || requests.length === 0) {
        res.status(400).json({
          ok: false,
          error: "Requests array is required",
        });
        return;
      }

      // Use a Map to aggregate by ingredientId
      const ingredientMap = new Map<
        string,
        {
          ingredientId: string;
          ingredientName: string;
          consumedQuantity: number;
          unit: string;
          currentStock: number;
          reorderPoint: number;
          minStock: number;
        }
      >();

      for (const req of requests) {
        const { menuItemId, quantity } = req;

        const menuItemResult = await menuItemRepository.findById(menuItemId);

        if (!menuItemResult.success || !menuItemResult.value) {
          continue;
        }

        const menuItem = menuItemResult.value;

        for (const ref of menuItem.getRequiredIngredients()) {
          const ingredientResult = await ingredientRepository.findById(
            ref.ingredientId,
          );

          if (!ingredientResult.success || !ingredientResult.value) {
            continue;
          }

          const ingredient = ingredientResult.value;
          const consumedQuantity = ref.quantity * quantity;
          const ingredientId = ingredient.id;

          if (ingredientMap.has(ingredientId)) {
            // Sum with existing consumption for this ingredient
            const existing = ingredientMap.get(ingredientId)!;
            existing.consumedQuantity += consumedQuantity;
          } else {
            // First time seeing this ingredient in the order
            ingredientMap.set(ingredientId, {
              ingredientId,
              ingredientName: ingredient.name,
              consumedQuantity,
              unit: ingredient.unit,
              currentStock: ingredient.getStock(),
              reorderPoint: ingredient.reorderPoint,
              minStock: ingredient.minStock,
            });
          }
        }
      }

      // Convert map to array and calculate remaining stock
      const previews = Array.from(ingredientMap.values()).map((item) => {
        const remainingStock = item.currentStock - item.consumedQuantity;

        return {
          ingredientId: item.ingredientId,
          ingredientName: item.ingredientName,
          consumedQuantity: item.consumedQuantity,
          remainingStock,
          unit: item.unit,
          isLowStock: remainingStock <= item.minStock,
          needsReorder: remainingStock <= item.reorderPoint,
          reorderPoint: item.reorderPoint,
        };
      });

      res.json({
        ok: true,
        value: previews,
      });
    } catch (error) {
      console.error("Error previewing deduction:", error);
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Server error",
      });
    }
  }

  // Add missing methods from InventoryAlertController:
  async getStockLevels(req: Request, res: Response): Promise<void> {
    try {
      const { ingredientRepository } = await this.getDependencies();
      const result = await this.ingredientRepository.findAll();

      if (!result.success) {
        res.status(404).json({ message: "Stock not found" });

        return;
      }

      const stockLevels = result.value.map((ing) => ({
        id: ing.id,
        name: ing.name,
        currentStock: ing.getStock(),
        minStock: ing.minStock,
        reorderPoint: ing.reorderPoint,
        unit: ing.unit,
        status: ing.getStockLevel(),
        isLowStock: ing.isLowStock(),
        needsReorder: ing.needsReorder(),
        costPerUnit: ing.costPerUnit,
        category: ing.category,
      }));

      res.json(
        ok({
          stockLevels,
          summary: {
            total: result.value.length,
            lowStock: result.value.filter((i) => i.isLowStock()).length,
            needsReorder: result.value.filter((i) => i.needsReorder()).length,
          },
        }),
      );
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  }

  async getDashboardData(req: Request, res: Response): Promise<void> {
    try {
      const stockResult = await this.ingredientRepository.findAll();

      if (!stockResult.success || !stockResult.value) {
        res.status(404).json({
          ok: false,
          error: "No inventory data found",
        });
        return;
      }

      const ingredients = stockResult.value;
      const criticalItems = ingredients.filter((i) => i.isLowStock());
      const lowItems = ingredients.filter(
        (i) => i.needsReorder() && !i.isLowStock(),
      );

      const totalValue = ingredients.reduce((sum, ing) => {
        return sum + ing.getStock() * ing.costPerUnit;
      }, 0);

      // Get usedIn information from menu items
      const menuItemResult = await this.menuItemRepository.findAllActive();
      const usedInMap = new Map();

      if (menuItemResult.success && menuItemResult.value) {
        for (const menuItem of menuItemResult.value) {
          for (const ref of menuItem.getRequiredIngredients()) {
            if (!usedInMap.has(ref.ingredientId)) {
              usedInMap.set(ref.ingredientId, []);
            }
            usedInMap.get(ref.ingredientId).push({
              menuItemId: menuItem.id,
              menuItemName: menuItem.name,
              quantityRequired: ref.quantity,
              unit: ref.unit,
            });
          }
        }
      }

      const ingredientsWithUsage = ingredients.map((ing) => ({
        id: ing.id,
        name: ing.name,
        currentStock: ing.getStock(),
        unit: ing.unit,
        minStock: ing.minStock,
        reorderPoint: ing.reorderPoint,
        costPerUnit: ing.costPerUnit,
        isLowStock: ing.isLowStock(),
        needsReorder: ing.needsReorder(),
        usedIn: usedInMap.get(ing.id) || [],
      }));

      res.json({
        ok: true,
        value: {
          inventory: {
            totalItems: ingredients.length,
            criticalItems: criticalItems.length,
            lowItems: lowItems.length,
            normalItems:
              ingredients.length - criticalItems.length - lowItems.length,
            totalValue: parseFloat(totalValue.toFixed(2)),
            ingredients: ingredientsWithUsage,
          },
          alerts: {
            enabled: true,
            checkInterval: 60,
          },
        },
      });
    } catch (error) {
      console.error("Error getting dashboard data:", error);
      res.status(500).json({
        ok: false,
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }

  async bulkUpdate(req: Request, res: Response): Promise<void> {
    try {
      const { updates } = req.body;
      const { ingredientRepository } = await this.getDependencies();

      if (!Array.isArray(updates) || updates.length === 0) {
        res.status(400).json({
          ok: false,
          error: "Updates array is required",
        });
        return;
      }

      const results = [];

      for (const update of updates) {
        const { ingredientId, newStock } = update;

        const ingredientResult =
          await this.ingredientRepository.findById(ingredientId);

        if (!ingredientResult.success || !ingredientResult.value) {
          results.push({
            ingredientId,
            success: false,
            error: "Ingredient not found",
          });
          continue;
        }

        const ingredient = ingredientResult.value;
        const setResult = ingredient.setStock(newStock);

        if (!setResult.success) {
          results.push({
            ingredientId,
            success: false,
            error: setResult.error.message,
          });
          continue;
        }

        const saveResult = await this.ingredientRepository.save(
          setResult.value,
        );

        if (!saveResult.success) {
          results.push({
            ingredientId,
            success: false,
            error: saveResult.error.message,
          });
          continue;
        }

        results.push({
          ingredientId,
          success: true,
        });
      }

      res.json({
        ok: true,
        value: results,
      });
    } catch (error) {
      console.error("Error in bulk update:", error);
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async updateStock(req: Request, res: Response): Promise<void> {
    try {
      const { ingredientId, newStock } = req.body;
      const { ingredientRepository } = await this.getDependencies();

      if (!ingredientId || newStock === undefined) {
        res.status(400).json({
          ok: false,
          error: "ingredientId and newStock are required",
        });
        return;
      }

      const ingredientResult =
        await this.ingredientRepository.findById(ingredientId);

      if (!ingredientResult.success || !ingredientResult.value) {
        res.status(404).json({
          ok: false,
          error: "Ingredient not found",
        });
        return;
      }

      const ingredient = ingredientResult.value;
      const setResult = ingredient.setStock(newStock);

      if (!setResult.success) {
        res.status(400).json({
          ok: false,
          error: setResult.error.message,
        });
        return;
      }

      const saveResult = await this.ingredientRepository.save(setResult.value);

      if (!saveResult.success) {
        res.status(500).json({
          ok: false,
          error: saveResult.error.message,
        });
        return;
      }

      res.json({
        ok: true,
        value: {
          success: true,
          message: "Stock updated successfully",
          ingredient: {
            id: saveResult.value.id,
            name: saveResult.value.name,
            currentStock: saveResult.value.getStock(),
            unit: saveResult.value.unit,
          },
        },
      });
    } catch (error) {
      console.error("Error updating stock:", error);
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async reorderIngredient(req: Request, res: Response): Promise<void> {
    try {
      const { ingredientId, quantity } = req.body;
      await this.getDependencies();

      if (!ingredientId) {
        res.status(400).json({
          ok: false,
          error: "ingredientId is required",
        });
        return;
      }

      // In a real implementation, this would create a purchase order
      // For now, just log and return success
      console.log(
        `Reorder requested for ingredient ${ingredientId}, quantity: ${quantity || "default"}`,
      );

      const reorderId = `REORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      res.json({
        ok: true,
        value: {
          success: true,
          message: "Reorder request submitted",
          reorderId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error creating reorder:", error);
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async getLowStockAlerts(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.ingredientRepository.findLowStockIngredients();
      const { ingredientRepository } = await this.getDependencies();

      if (!result.success) {
        res.status(500).json({
          ok: false,
          error: result.error.message,
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

      res.json({
        ok: true,
        value: alerts,
      });
    } catch (error) {
      console.error("Error getting low stock alerts:", error);
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
