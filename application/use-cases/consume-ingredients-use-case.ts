import { MenuItemRepository } from '../../repositories/menu-item-repository';
import { IngredientRepository } from '../../repositories/ingredient-repository';
import { Result, ok, err } from '../../shared/result';

export interface ConsumptionRequest {
  menuItemId: string;
  quantity: number;
}

export class ConsumeIngredientsUseCase {
  constructor(
    private menuItemRepository: MenuItemRepository,
    private ingredientRepository: IngredientRepository
  ) {}

  async execute(request: ConsumptionRequest): Promise<Result<void>> {
    try {
      // Validate request
      if (request.quantity <= 0) {
        return err(new Error('Quantity must be positive'));
      }

      // Get menu item
      const menuItemResult = await this.menuItemRepository
        .findById(request.menuItemId);
      
      if (!menuItemResult.success) {
        return menuItemResult;
      }

      const menuItem = menuItemResult.value;
      if (!menuItem) {
        return err(new Error('Menu item not found'));
      }

      // Get required ingredients
      const ingredientIds = menuItem.getRequiredIngredients()
        .map(ref => ref.ingredientId);
      
      const ingredientsResult = await this.ingredientRepository
        .findByIds(ingredientIds);
      
      if (!ingredientsResult.success) {
        return ingredientsResult;
      }

      const ingredients = ingredientsResult.value;
      const ingredientMap = new Map(
        ingredients.map(ing => [ing.id, ing])
      );

      // Validate all ingredients exist
      for (const ref of menuItem.getRequiredIngredients()) {
        if (!ingredientMap.has(ref.ingredientId)) {
          return err(new Error(`Ingredient ${ref.ingredientId} not found`));
        }
      }

      // Calculate total consumption
      const consumptionMap = new Map<string, number>();
      for (const ref of menuItem.getRequiredIngredients()) {
        const totalQuantity = ref.quantity * request.quantity;
        consumptionMap.set(ref.ingredientId, totalQuantity);
      }

      // Consume ingredients
      const updatedIngredients: typeof ingredients = [];
      for (const [ingredientId, quantity] of consumptionMap) {
        const ingredient = ingredientMap.get(ingredientId)!;
        const consumeResult = ingredient.consume(quantity);
        
        if (!consumeResult.success) {
          return consumeResult;
        }
        
        updatedIngredients.push(consumeResult.value);
      }

      // Save updated ingredients
      for (const ingredient of updatedIngredients) {
        const saveResult = await this.ingredientRepository.save(ingredient);
        if (!saveResult.success) {
          return saveResult;
        }
      }

      return ok(undefined);
    } catch (error) {
      return err(new Error(`Failed to consume ingredients: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }
}