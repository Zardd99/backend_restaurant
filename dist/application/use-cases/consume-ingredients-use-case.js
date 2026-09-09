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
        var _a, _b, _c;
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
            const references = menuItem.getRequiredIngredients();
            const ingredientIds = references.map((ref) => ref.ingredientId);
            const ingredientsResult = await this.ingredientRepository.findByIds(ingredientIds);
            if (!ingredientsResult.success)
                return ingredientsResult;
            const ingredientMap = new Map(ingredientsResult.value.map((ingredient) => [ingredient.id, ingredient]));
            const warnings = [];
            const deductions = [];
            for (const ref of references) {
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
                deductions.push({
                    ingredientId: ref.ingredientId,
                    quantity: ref.quantity * request.quantity,
                });
            }
            const consumeResult = await this.ingredientRepository.consumeAtomic(deductions);
            if (!consumeResult.success) {
                const message = consumeResult.error.message;
                if (message.startsWith("INSUFFICIENT_STOCK:")) {
                    const failedId = message.split(":")[1];
                    const name = (_b = (_a = ingredientMap.get(failedId)) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : failedId;
                    return (0, result_1.err)(new Error(`Insufficient stock for ${name}`));
                }
                return (0, result_1.err)(consumeResult.error);
            }
            const afterResult = await this.ingredientRepository.findByIds(ingredientIds);
            const afterMap = afterResult.success
                ? new Map(afterResult.value.map((ingredient) => [ingredient.id, ingredient]))
                : ingredientMap;
            let totalCost = 0;
            const consumptionResults = [];
            for (const deduction of deductions) {
                const before = ingredientMap.get(deduction.ingredientId);
                const after = (_c = afterMap.get(deduction.ingredientId)) !== null && _c !== void 0 ? _c : before;
                totalCost += before.calculateCost(deduction.quantity);
                consumptionResults.push({
                    ingredientId: deduction.ingredientId,
                    consumedQuantity: deduction.quantity,
                    remainingStock: after.getStock(),
                    isLowStock: after.isLowStock(),
                    needsReorder: after.needsReorder(),
                });
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