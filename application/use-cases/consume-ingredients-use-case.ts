import { MenuItemRepository } from "../../repositories/menu-item-repository";
import {
  IngredientRepository,
  IngredientDeduction,
} from "../../repositories/ingredient-repository";
import { Result, ok, err } from "../../shared/result";
import { ConsumptionResult, Ingredient } from "../../models/ingredient";

export interface ConsumptionRequest {
  menuItemId: string;
  quantity: number;
}

export interface ConsumptionResponse {
  success: boolean;
  menuItemName: string;
  totalCost: number;
  consumptionResults: ConsumptionResult[];
  warnings: string[];
}

/**
 * Use Case: ConsumeIngredients
 *
 * Translates a menu-item sale into ingredient stock reductions. All stock
 * mutation is delegated to a single atomic repository call, eliminating the
 * read-check-write race and partial-write corruption of the previous loop.
 */
export class ConsumeIngredientsUseCase {
  constructor(
    private menuItemRepository: MenuItemRepository,
    private ingredientRepository: IngredientRepository,
  ) {}

  async execute(
    request: ConsumptionRequest,
  ): Promise<Result<ConsumptionResponse>> {
    try {
      if (request.quantity <= 0) {
        return err(new Error("Quantity must be positive"));
      }

      const menuItemResult = await this.menuItemRepository.findById(
        request.menuItemId,
      );
      if (!menuItemResult.success) return menuItemResult;

      const menuItem = menuItemResult.value;
      if (!menuItem) {
        return err(new Error("Menu item not found"));
      }
      if (!menuItem.isActive) {
        return err(new Error("Menu item is not available"));
      }

      const references = menuItem.getRequiredIngredients();
      const ingredientIds = references.map((ref) => ref.ingredientId);

      const ingredientsResult =
        await this.ingredientRepository.findByIds(ingredientIds);
      if (!ingredientsResult.success) return ingredientsResult;

      const ingredientMap = new Map<string, Ingredient>(
        ingredientsResult.value.map((ingredient) => [ingredient.id, ingredient]),
      );

      // Validation + planning. No stock is mutated here.
      const warnings: string[] = [];
      const deductions: IngredientDeduction[] = [];
      for (const ref of references) {
        const ingredient = ingredientMap.get(ref.ingredientId);
        if (!ingredient) {
          return err(new Error(`Ingredient ${ref.ingredientId} not found`));
        }
        if (!ingredient.isActive) {
          return err(new Error(`Ingredient ${ingredient.name} is not active`));
        }
        if (ref.unit !== ingredient.unit) {
          warnings.push(
            `Unit mismatch for ${ingredient.name}: Menu item uses ${ref.unit}, ingredient uses ${ingredient.unit}`,
          );
        }
        deductions.push({
          ingredientId: ref.ingredientId,
          quantity: ref.quantity * request.quantity,
        });
      }

      // The single, atomic, all-or-nothing stock mutation.
      const consumeResult =
        await this.ingredientRepository.consumeAtomic(deductions);
      if (!consumeResult.success) {
        const message = consumeResult.error.message;
        if (message.startsWith("INSUFFICIENT_STOCK:")) {
          const failedId = message.split(":")[1];
          const name = ingredientMap.get(failedId)?.name ?? failedId;
          return err(new Error(`Insufficient stock for ${name}`));
        }
        return err(consumeResult.error);
      }

      // Read committed state back for accurate remaining stock / low-stock flags.
      const afterResult =
        await this.ingredientRepository.findByIds(ingredientIds);
      const afterMap: Map<string, Ingredient> = afterResult.success
        ? new Map(afterResult.value.map((ingredient) => [ingredient.id, ingredient]))
        : ingredientMap;

      let totalCost = 0;
      const consumptionResults: ConsumptionResult[] = [];
      for (const deduction of deductions) {
        const before = ingredientMap.get(deduction.ingredientId)!;
        const after = afterMap.get(deduction.ingredientId) ?? before;
        totalCost += before.calculateCost(deduction.quantity);
        consumptionResults.push({
          ingredientId: deduction.ingredientId,
          consumedQuantity: deduction.quantity,
          remainingStock: after.getStock(),
          isLowStock: after.isLowStock(),
          needsReorder: after.needsReorder(),
        });
      }

      return ok({
        success: true,
        menuItemName: menuItem.name,
        totalCost,
        consumptionResults,
        warnings,
      });
    } catch (error) {
      return err(
        new Error(
          `Failed to consume ingredients: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    }
  }
}
