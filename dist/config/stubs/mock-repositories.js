"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockLowStockNotificationRepository = exports.MockMenuItemRepository = void 0;
const result_1 = require("../../shared/result");
class MockMenuItemRepository {
    constructor() {
        this.mockData = [];
    }
    async findById(id) {
        const item = this.mockData.find((item) => item.id === id);
        return (0, result_1.ok)(item || null);
    }
    async findAllActive() {
        return (0, result_1.ok)(this.mockData.filter((item) => item.isActive));
    }
    async findByIds(ids) {
        const items = this.mockData.filter((item) => ids.includes(item.id));
        return (0, result_1.ok)(items);
    }
    async save(menuItem) {
        const index = this.mockData.findIndex((item) => item.id === menuItem.id);
        if (index >= 0) {
            this.mockData[index] = menuItem;
        }
        else {
            this.mockData.push(menuItem);
        }
        return (0, result_1.ok)(menuItem);
    }
    addMockData(items) {
        this.mockData.push(...items);
    }
}
exports.MockMenuItemRepository = MockMenuItemRepository;
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
        const index = this.notifications.findIndex((n) => n.id === id);
        this.notifications[index] = updatedNotification;
        return (0, result_1.ok)(updatedNotification);
    }
    async findByIngredientId(ingredientId) {
        const notification = this.notifications.find((n) => n.ingredientId === ingredientId && !n.acknowledged);
        return (0, result_1.ok)(notification || null);
    }
}
exports.MockLowStockNotificationRepository = MockLowStockNotificationRepository;
//# sourceMappingURL=mock-repositories.js.map