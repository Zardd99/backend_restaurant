"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsumeIngredientsUseCase = void 0;
const result_1 = require("../../shared/result");
class ConsumeIngredientsUseCase {
    constructor(menuItemRepository, ingredientRepository) {
        this.menuItemRepository = menuItemRepository;
        this.ingredientRepository = ingredientRepository;
    }
    async execute(request) {
        try {
            if (request.quantity <= 0) {
                return (0, result_1.err)(new Error("Quantity must be positive"));
            }
            const menuItemResult = await this.menuItemRepository.findById(request.menuItemId);
            if (!menuItemResult.success)
                return menuItemResult;
            const menuItem = menuItemResult.value;
            if (!menuItem) {
                return (0, result_1.err)(new Error("Menu item not found"));
            }
            if (!menuItem.isActive) {
                return (0, result_1.err)(new Error("Menu item is not available"));
            }
            const ingredientIds = menuItem
                .getRequiredIngredients()
                .map((ref) => ref.ingredientId);
            const ingredientsResult = await this.ingredientRepository.findByIds(ingredientIds);
            if (!ingredientsResult.success)
                return ingredientsResult;
            const ingredients = ingredientsResult.value;
            const ingredientMap = new Map(ingredients.map((ing) => [ing.id, ing]));
            const warnings = [];
            for (const ref of menuItem.getRequiredIngredients()) {
                const ingredient = ingredientMap.get(ref.ingredientId);
                if (!ingredient) {
                    return (0, result_1.err)(new Error(`Ingredient ${ref.ingredientId} not found`));
                }
                if (!ingredient.isActive) {
                    return (0, result_1.err)(new Error(`Ingredient ${ingredient.name} is not active`));
                }
                if (ref.unit !== ingredient.unit) {
                    warnings.push(`Unit mismatch for ${ingredient.name}: Menu item uses ${ref.unit}, ingredient uses ${ingredient.unit}`);
                }
            }
            const consumptionMap = new Map();
            for (const ref of menuItem.getRequiredIngredients()) {
                const totalQuantity = ref.quantity * request.quantity;
                consumptionMap.set(ref.ingredientId, totalQuantity);
            }
            const consumptionResults = [];
            const updatedIngredients = [];
            for (const [ingredientId, quantity] of consumptionMap) {
                const ingredient = ingredientMap.get(ingredientId);
                if (quantity > ingredient.getStock()) {
                    return (0, result_1.err)(new Error(`Insufficient stock for ${ingredient.name}. Available: ${ingredient.getStock()}${ingredient.unit}, Required: ${quantity}${ingredient.unit}`));
                }
                const consumeResult = ingredient.consume(quantity);
                if (!consumeResult.success)
                    return consumeResult;
                updatedIngredients.push(consumeResult.value);
                consumptionResults.push({
                    ingredientId,
                    consumedQuantity: quantity,
                    remainingStock: consumeResult.value.getStock(),
                    isLowStock: consumeResult.value.isLowStock(),
                    needsReorder: consumeResult.value.needsReorder(),
                });
            }
            for (const ingredient of updatedIngredients) {
                const saveResult = await this.ingredientRepository.save(ingredient);
                if (!saveResult.success)
                    return saveResult;
            }
            let totalCost = 0;
            for (const ref of menuItem.getRequiredIngredients()) {
                const ingredient = ingredientMap.get(ref.ingredientId);
                totalCost += ingredient.calculateCost(ref.quantity * request.quantity);
            }
            return (0, result_1.ok)({
                success: true,
                menuItemName: menuItem.name,
                totalCost,
                consumptionResults,
                warnings,
            });
        }
        catch (error) {
            return (0, result_1.err)(new Error(`Failed to consume ingredients: ${error instanceof Error ? error.message : "Unknown error"}`));
        }
    }
}
exports.ConsumeIngredientsUseCase = ConsumeIngredientsUseCase;
//# sourceMappingURL=consume-ingredients-use-case.js.map