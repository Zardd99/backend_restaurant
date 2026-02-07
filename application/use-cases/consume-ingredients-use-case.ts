import { MenuItemRepository } from "../../repositories/menu-item-repository";
import { IngredientRepository } from "../../repositories/ingredient-repository";
import { Result, ok, err } from "../../shared/result";
import { ConsumptionResult } from "../../models/ingredient";

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
 * * Business Logic:
 * Translates a Menu Item sale into specific ingredient stock reductions.
 * Performs critical validation on availability, unit compatibility, and stock levels
 * before committing any changes to the database.
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
      // 1. Basic Request Validation
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

      // Ensure the item is currently on the menu (business availability)
      if (!menuItem.isActive) {
        return err(new Error("Menu item is not available"));
      }

      // 2. Ingredient Resolution
      // Fetch all required ingredients in a single batch to minimize database round-trips
      const ingredientIds = menuItem
        .getRequiredIngredients()
        .map((ref) => ref.ingredientId);

      const ingredientsResult =
        await this.ingredientRepository.findByIds(ingredientIds);

      if (!ingredientsResult.success) return ingredientsResult;

      const ingredients = ingredientsResult.value;
      const ingredientMap = new Map(ingredients.map((ing) => [ing.id, ing]));

      /**
       * 3. Pre-Consumption Validation
       * We verify existence, status, and unit compatibility before attempting any state changes.
       */
      const warnings: string[] = [];
      for (const ref of menuItem.getRequiredIngredients()) {
        const ingredient = ingredientMap.get(ref.ingredientId);
        if (!ingredient) {
          return err(new Error(`Ingredient ${ref.ingredientId} not found`));
        }
        if (!ingredient.isActive) {
          return err(new Error(`Ingredient ${ingredient.name} is not active`));
        }

        // Flag unit mismatches (e.g., recipe says 'grams' but inventory is in 'liters')
        if (ref.unit !== ingredient.unit) {
          warnings.push(
            `Unit mismatch for ${ingredient.name}: Menu item uses ${ref.unit}, ingredient uses ${ingredient.unit}`,
          );
        }
      }

      /**
       * 4. Stock Calculation & Consistency Check
       * We calculate the full impact first. If one ingredient is missing, the whole order fails.
       */
      const consumptionMap = new Map<string, number>();
      for (const ref of menuItem.getRequiredIngredients()) {
        const totalQuantity = ref.quantity * request.quantity;
        consumptionMap.set(ref.ingredientId, totalQuantity);
      }

      const consumptionResults: ConsumptionResult[] = [];
      const updatedIngredients: typeof ingredients = [];

      for (const [ingredientId, quantity] of consumptionMap) {
        const ingredient = ingredientMap.get(ingredientId)!;

        // Verify sufficient stock exists before calling the domain 'consume' method
        if (quantity > ingredient.getStock()) {
          return err(
            new Error(
              `Insufficient stock for ${ingredient.name}. Available: ${ingredient.getStock()}${ingredient.unit}, Required: ${quantity}${ingredient.unit}`,
            ),
          );
        }

        const consumeResult = ingredient.consume(quantity);
        if (!consumeResult.success) return consumeResult;

        updatedIngredients.push(consumeResult.value);

        consumptionResults.push({
          ingredientId,
          consumedQuantity: quantity,
          remainingStock: consumeResult.value.getStock(),
          isLowStock: consumeResult.value.isLowStock(),
          needsReorder: consumeResult.value.needsReorder(),
        });
      }

      /**
       * 5. Persistence Phase
       * FIXME: These save operations should ideally be wrapped in a database transaction
       * to prevent partial stock updates if one save fails.
       */
      for (const ingredient of updatedIngredients) {
        const saveResult = await this.ingredientRepository.save(ingredient);
        if (!saveResult.success) return saveResult;
      }

      // 6. Final Financial Calculation (Optional: could be moved to a Costing Service)
      let totalCost = 0;
      for (const ref of menuItem.getRequiredIngredients()) {
        const ingredient = ingredientMap.get(ref.ingredientId)!;
        totalCost += ingredient.calculateCost(ref.quantity * request.quantity);
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
