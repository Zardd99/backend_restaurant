"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockLowStockNotificationRepository = void 0;
const result_1 = require("../../shared/result");
class MockLowStockNotificationRepository {
    constructor() {
        this.notifications = [];
    }
    async create(notification) {
        this.notifications.push(notification);
        return (0, result_1.ok)(notification);
    }
    async findUnacknowledged() {
        const unacknowledged = this.notifications.filter((n) => !n.acknowledged);
        return (0, result_1.ok)(unacknowledged);
    }
    async acknowledge(id, userId) {
        const notification = this.notifications.find((n) => n.id === id);
        if (!notification) {
            return (0, result_1.err)(new Error("Notification not found"));
        }
        const updatedNotification = Object.assign(Object.assign({}, notification), { acknowledged: true, acknowledgedBy: userId, acknowledgedAt: new Date() });
        return (0, result_1.ok)(updatedNotification);
    }
    async findByIngredientId(ingredientId) {
        const notification = this.notifications.find((n) => n.ingredientId === ingredientId && !n.acknowledged);
        return (0, result_1.ok)(notification || null);
    }
    async findRecentByIngredientId(ingredientId, hours) {
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
        const notification = this.notifications.find((n) => n.ingredientId === ingredientId && n.notifiedAt > cutoff);
        return (0, result_1.ok)(notification || null);
    }
}
exports.MockLowStockNotificationRepository = MockLowStockNotificationRepository;
//# sourceMappingURL=mock-low-stock-notification-repository.js.map