"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckLowStockUseCase = void 0;
const low_stock_notification_1 = require("../../models/low-stock-notification");
const result_1 = require("../../shared/result");
class CheckLowStockUseCase {
    constructor(ingredientRepository, notificationRepository) {
        this.ingredientRepository = ingredientRepository;
        this.notificationRepository = notificationRepository;
    }
    async execute() {
        try {
            const lowStockResult = await this.ingredientRepository.findLowStockIngredients();
            if (!lowStockResult.success) {
                return lowStockResult;
            }
            const lowStockIngredients = lowStockResult.value;
            let notificationsCreated = 0;
            for (const ingredient of lowStockIngredients) {
                const existingNotification = await this.notificationRepository.findByIngredientId(ingredient.id);
                if (!existingNotification.success) {
                    continue;
                }
                if (!existingNotification.value) {
                    const notificationResult = low_stock_notification_1.LowStockNotificationFactory.create(this.generateId(), ingredient.id, ingredient.name, ingredient.getStock(), ingredient.minStock, result_1.err);
                    if (notificationResult.success) {
                        const saveResult = await this.notificationRepository.create(notificationResult.value);
                        if (saveResult.success) {
                            notificationsCreated++;
                        }
                    }
                }
            }
            return (0, result_1.ok)({
                lowStockIngredients: lowStockIngredients.map((ingredient) => ({
                    id: ingredient.id,
                    name: ingredient.name,
                    currentStock: ingredient.getStock(),
                    minStock: ingredient.minStock,
                    reorderPoint: ingredient.reorderPoint,
                    unit: ingredient.unit,
                })),
                notificationsCreated,
            });
        }
        catch (error) {
            return (0, result_1.err)(new Error(`Failed to check low stock: ${error instanceof Error ? error.message : "Unknown error"}`));
        }
    }
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.CheckLowStockUseCase = CheckLowStockUseCase;
//# sourceMappingURL=check-low-stock-use-case.js.map