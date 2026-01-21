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

export class ConsumeIngredientsUseCase {
  constructor(
    private menuItemRepository: MenuItemRepository,
    private ingredientRepository: IngredientRepository,
  ) {}

  async execute(
    request: ConsumptionRequest,
  ): Promise<Result<ConsumptionResponse>> {
    try {
      // Validate request
      if (request.quantity <= 0) {
        return err(new Error("Quantity must be positive"));
      }

      // Get menu item
      const menuItemResult = await this.menuItemRepository.findById(
        request.menuItemId,
      );

      if (!menuItemResult.success) {
        return menuItemResult;
      }

      const menuItem = menuItemResult.value;
      if (!menuItem) {
        return err(new Error("Menu item not found"));
      }

      // Check if menu item is available
      if (!menuItem.isActive) {
        return err(new Error("Menu item is not available"));
      }

      // Get required ingredients
      const ingredientIds = menuItem
        .getRequiredIngredients()
        .map((ref) => ref.ingredientId);

      const ingredientsResult =
        await this.ingredientRepository.findByIds(ingredientIds);

      if (!ingredientsResult.success) {
        return ingredientsResult;
      }

      const ingredients = ingredientsResult.value;
      const ingredientMap = new Map(ingredients.map((ing) => [ing.id, ing]));

      // Validate all ingredients exist and are active
      const warnings: string[] = [];
      for (const ref of menuItem.getRequiredIngredients()) {
        const ingredient = ingredientMap.get(ref.ingredientId);
        if (!ingredient) {
          return err(new Error(`Ingredient ${ref.ingredientId} not found`));
        }
        if (!ingredient.isActive) {
          return err(new Error(`Ingredient ${ingredient.name} is not active`));
        }

        // Check unit compatibility
        if (ref.unit !== ingredient.unit) {
          warnings.push(
            `Unit mismatch for ${ingredient.name}: Menu item uses ${ref.unit}, ingredient uses ${ingredient.unit}`,
          );
        }
      }

      // Calculate total consumption
      const consumptionMap = new Map<string, number>();
      for (const ref of menuItem.getRequiredIngredients()) {
        const totalQuantity = ref.quantity * request.quantity;
        consumptionMap.set(ref.ingredientId, totalQuantity);
      }

      // Consume ingredients
      const consumptionResults: ConsumptionResult[] = [];
      const updatedIngredients: typeof ingredients = [];

      for (const [ingredientId, quantity] of consumptionMap) {
        const ingredient = ingredientMap.get(ingredientId)!;

        // Check stock availability
        if (quantity > ingredient.getStock()) {
          return err(
            new Error(
              `Insufficient stock for ${ingredient.name}. Available: ${ingredient.getStock()}${ingredient.unit}, Required: ${quantity}${ingredient.unit}`,
            ),
          );
        }

        const consumeResult = ingredient.consume(quantity);

        if (!consumeResult.success) {
          return consumeResult;
        }

        updatedIngredients.push(consumeResult.value);

        consumptionResults.push({
          ingredientId,
          consumedQuantity: quantity,
          remainingStock: consumeResult.value.getStock(),
          isLowStock: consumeResult.value.isLowStock(),
          needsReorder: consumeResult.value.needsReorder(),
        });
      }

      // Save updated ingredients
      for (const ingredient of updatedIngredients) {
        const saveResult = await this.ingredientRepository.save(ingredient);
        if (!saveResult.success) {
          return saveResult;
        }
      }

      // Calculate total cost
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
