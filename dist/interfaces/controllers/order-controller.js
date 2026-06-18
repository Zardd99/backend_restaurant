"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderController = void 0;
const dependencies_1 = require("../../config/dependencies");
class OrderController {
    constructor() {
        const container = dependencies_1.DependencyContainer.getInstance();
        this.inventoryManager = container.resolve("InventoryManager");
    }
    async createOrder(req, res) {
        try {
            const { items, customerName, customerEmail, notes } = req.body;
            if (!items || !Array.isArray(items) || items.length === 0) {
                res.status(400).json({
                    success: false,
                    message: "Order must contain at least one item",
                });
                return;
            }
            const inventoryResult = await this.inventoryManager.processOrder(items);
            if (!inventoryResult.success) {
                res.status(400).json({
                    success: false,
                    message: "Failed to process order",
                    error: inventoryResult.error.message,
                });
                return;
            }
            const { successful, consumedIngredients, failedItems } = inventoryResult.value;
            if (!successful) {
                res.status(400).json({
                    success: false,
                    message: "Some items could not be processed",
                    failedItems,
                    consumedIngredients,
                });
                return;
            }
            const lowStockItems = consumedIngredients.filter((item) => item.needsReorder);
            const order = {
                orderNumber: `ORD-${Date.now()}`,
                items,
                customerName,
                customerEmail,
                notes,
                totalAmount: items.reduce((sum, item) => sum + (item.price || 0), 0),
                status: "completed",
                createdAt: new Date(),
            };
            res.json({
                success: true,
                message: "Order created successfully",
                order: Object.assign(Object.assign({}, order), { inventoryConsumed: true, lowStockAlerts: lowStockItems.length, consumptionResults: consumedIngredients }),
            });
            if (lowStockItems.length > 0) {
                console.warn(`Order triggered low stock for ${lowStockItems.length} ingredients`);
            }
        }
        catch (error) {
            console.error("Order creation error:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    async getOrderStatus(req, res) {
        try {
            const { orderId } = req.params;
            const order = {
                id: orderId,
                status: "completed",
                items: [],
            };
            res.json({
                success: true,
                order,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
}
exports.OrderController = OrderController;
//# sourceMappingURL=order-controller.js.map