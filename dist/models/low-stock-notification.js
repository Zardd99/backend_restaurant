"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LowStockNotificationFactory = void 0;
const result_1 = require("../shared/result");
class LowStockNotificationFactory {
    static create(id, ingredientId, ingredientName, currentStock, minStock, err) {
        if (!ingredientId) {
            return err(new Error("Ingredient ID is required"));
        }
        if (!ingredientName) {
            return err(new Error("Ingredient name is required"));
        }
        if (currentStock < 0) {
            return err(new Error("Current stock cannot be negative"));
        }
        if (minStock < 0) {
            return err(new Error("Minimum stock cannot be negative"));
        }
        return (0, result_1.ok)({
            id,
            ingredientId,
            ingredientName,
            currentStock,
            minStock,
            notifiedAt: new Date(),
            acknowledged: false,
        });
    }
}
exports.LowStockNotificationFactory = LowStockNotificationFactory;
//# sourceMappingURL=low-stock-notification.js.map