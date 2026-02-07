/**
 * Inventory Management API Endpoints
 *
 * Responsibility:
 * - Exposes HTTP endpoints for inventory-related operations
 * - Coordinates between InventoryManager and domain repositories
 *
 * Scope:
 * - Ingredient availability checks
 * - Stock consumption & previews
 * - Inventory dashboard & alerts
 * - Manual and bulk stock updates
 *
 * Note:
 * - Business rules are delegated to application/domain layers
 * - This layer focuses on request validation and response shaping
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
    // Resolve dependencies from central container
    const container = DependencyContainer.getInstance();
    this.inventoryManager = container.resolve("InventoryManager");
    this.ingredientRepository = container.resolve("IngredientRepository");
    this.menuItemRepository = container.resolve("MenuItemRepository");
  }

  /**
   * Lazily re-resolve dependencies if they are missing
   * Useful for environments with delayed initialization or hot reloads
   */
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
   *
   * Checks whether requested menu items can be fulfilled
   * based on current ingredient stock levels.
   *
   * Request Body:
   * - items: [{ menuItemId, quantity }]
   *
   * Response:
   * - availability per menu item
   * - missing ingredients if stock is insufficient
   */
  async checkAvailability(req: Request, res: Response): Promise<void> {
    try {
      const { items } = req.body;

      // Validate request payload
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

      // Evaluate availability per requested menu item
      for (const item of items) {
        const { menuItemId, quantity } = item;

        const menuItemResult = await menuItemRepository.findById(menuItemId);

        // Handle missing menu item gracefully
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

        // Validate ingredient stock requirements
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

  /**
   * POST /api/inventory/consume
   *
   * Deducts ingredient stock based on confirmed menu item orders.
   * Multiple requests are processed and results are aggregated
   * by ingredient.
   *
   * Request Body:
   * - requests: [{ menuItemId, quantity }]
   */
  async consumeIngredients(req: Request, res: Response): Promise<void> {
    try {
      const { requests } = req.body;
      const { inventoryManager, ingredientRepository, menuItemRepository } =
        await this.getDependencies();

      // Validate request payload
      if (!Array.isArray(requests) || requests.length === 0) {
        res.status(400).json({
          ok: false,
          error: "Requests array is required",
        });
        return;
      }

      /**
       * Aggregate ingredient requirements across all requests.
       * This prevents duplicate deductions and ensures consistency.
       */
      const ingredientRequirements = new Map<string, number>();

      for (const req of requests) {
        const { menuItemId, quantity } = req;

        const menuItemResult = await menuItemRepository.findById(menuItemId);
        if (!menuItemResult.success || !menuItemResult.value) continue;

        const menuItem = menuItemResult.value;

        for (const ref of menuItem.getRequiredIngredients()) {
          const current = ingredientRequirements.get(ref.ingredientId) || 0;

          ingredientRequirements.set(
            ref.ingredientId,
            current + ref.quantity * quantity,
          );
        }
      }

      /**
       * Process orders individually to leverage InventoryManager logic
       * while aggregating final deduction results.
       */
      const allDeductionResults: any[] = [];

      for (const req of requests) {
        const items = [{ menuItemId: req.menuItemId, quantity: req.quantity }];
        const result = await inventoryManager.processOrder(items);

        if (!result.success) continue;

        for (const consumption of result.value.consumedIngredients) {
          const ingredientResult = await ingredientRepository.findById(
            consumption.ingredientId,
          );

          if (ingredientResult.success && ingredientResult.value) {
            const ingredient = ingredientResult.value;

            const existingIndex = allDeductionResults.findIndex(
              (r) => r.ingredientId === consumption.ingredientId,
            );

            // Merge consumption records per ingredient
            if (existingIndex >= 0) {
              allDeductionResults[existingIndex].consumedQuantity +=
                consumption.consumedQuantity;
              allDeductionResults[existingIndex].remainingStock =
                ingredient.getStock();
            } else {
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

  /**
   * POST /api/inventory/preview-deduction
   *
   * Simulates ingredient consumption without mutating stock.
   * Useful for order previews and validation before confirmation.
   */
  async previewDeduction(req: Request, res: Response): Promise<void> {
    try {
      const { requests } = req.body;
      const { menuItemRepository, ingredientRepository } =
        await this.getDependencies();

      // Validate request payload
      if (!Array.isArray(requests) || requests.length === 0) {
        res.status(400).json({
          ok: false,
          error: "Requests array is required",
        });
        return;
      }

      /**
       * Aggregate preview consumption by ingredient
       * to present a clean and accurate summary.
       */
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
        if (!menuItemResult.success || !menuItemResult.value) continue;

        const menuItem = menuItemResult.value;

        for (const ref of menuItem.getRequiredIngredients()) {
          const ingredientResult = await ingredientRepository.findById(
            ref.ingredientId,
          );

          if (!ingredientResult.success || !ingredientResult.value) continue;

          const ingredient = ingredientResult.value;
          const consumedQuantity = ref.quantity * quantity;
          const ingredientId = ingredient.id;

          if (ingredientMap.has(ingredientId)) {
            ingredientMap.get(ingredientId)!.consumedQuantity +=
              consumedQuantity;
          } else {
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

      // Derive remaining stock and alert flags
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

  /**
   * GET /api/inventory/stock-levels
   *
   * Returns detailed stock information for all ingredients,
   * including alert and reorder indicators.
   */
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

  /**
   * GET /api/inventory/dashboard
   *
   * Provides aggregated inventory metrics for dashboard views:
   * - stock health
   * - inventory value
   * - menu item usage
   */
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

      // Categorize stock health
      const criticalItems = ingredients.filter((i) => i.isLowStock());
      const lowItems = ingredients.filter(
        (i) => i.needsReorder() && !i.isLowStock(),
      );

      // Calculate total inventory value
      const totalValue = ingredients.reduce((sum, ing) => {
        return sum + ing.getStock() * ing.costPerUnit;
      }, 0);

      /**
       * Build ingredient usage map from active menu items
       * to support traceability and planning.
       */
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

  /**
   * POST /api/inventory/bulk-update
   *
   * Updates stock levels for multiple ingredients in a single request.
   * Each update is processed independently to avoid partial failures.
   */
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

  /**
   * POST /api/inventory/update-stock
   *
   * Updates stock level for a single ingredient.
   */
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

  /**
   * POST /api/inventory/reorder
   *
   * Initiates a reorder request for an ingredient.
   * Current implementation is a placeholder for purchase workflow.
   */
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

      // Placeholder for purchase order integration
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

  /**
   * GET /api/inventory/low-stock-alerts
   *
   * Returns ingredients that are currently low on stock
   * or require immediate reorder.
   */
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
