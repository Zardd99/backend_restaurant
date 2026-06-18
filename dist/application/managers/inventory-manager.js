"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryManager = void 0;
const result_1 = require("../../shared/result");
class InventoryManager {
    constructor(checkLowStockUseCase, consumeIngredientsUseCase, emailService, notificationRepository, ingredientRepository, alertConfig) {
        this.checkLowStockUseCase = checkLowStockUseCase;
        this.consumeIngredientsUseCase = consumeIngredientsUseCase;
        this.emailService = emailService;
        this.notificationRepository = notificationRepository;
        this.ingredientRepository = ingredientRepository;
        this.alertConfig = alertConfig;
        this.isProcessingAlerts = false;
        this.maxQueueSize = 1000;
        this.realTimeAlertQueue = [];
    }
    async processOrder(orderItems) {
        try {
            const results = [];
            const failedItems = [];
            for (const item of orderItems) {
                const consumeResult = await this.consumeIngredientsForMenuItem(item.menuItemId, item.quantity);
                if (consumeResult.success) {
                    results.push(...consumeResult.value);
                    for (const consumption of consumeResult.value) {
                        if (consumption.needsReorder) {
                            const ingredientResult = await this.ingredientRepository.findById(consumption.ingredientId);
                            if (ingredientResult.success && ingredientResult.value) {
                                const ingredient = ingredientResult.value;
                                await this.sendRealTimeAlert({
                                    ingredientId: consumption.ingredientId,
                                    ingredientName: ingredient.name,
                                    currentStock: consumption.remainingStock,
                                    minStock: ingredient.minStock,
                                    unit: ingredient.unit,
                                    timestamp: new Date(),
                                });
                            }
                        }
                    }
                }
                else {
                    failedItems.push({
                        menuItemId: item.menuItemId,
                        error: consumeResult.error.message,
                    });
                }
            }
            return (0, result_1.ok)({
                successful: failedItems.length === 0,
                consumedIngredients: results,
                failedItems,
            });
        }
        catch (error) {
            return (0, result_1.err)(new Error(`Failed to process order: ${error instanceof Error ? error.message : "Unknown error"}`));
        }
    }
    async consumeIngredientsForMenuItem(menuItemId, quantity) {
        try {
            const consumeResult = await this.consumeIngredientsUseCase.execute({
                menuItemId,
                quantity,
            });
            if (!consumeResult.success) {
                return (0, result_1.err)(consumeResult.error);
            }
            return (0, result_1.ok)(consumeResult.value.consumptionResults);
        }
        catch (error) {
            return (0, result_1.err)(new Error(`Failed to consume ingredients: ${error instanceof Error ? error.message : "Unknown error"}`));
        }
    }
    async checkAndAlertLowStock() {
        try {
            const checkResult = await this.checkLowStockUseCase.execute();
            if (!checkResult.success) {
                return checkResult;
            }
            const { lowStockIngredients, notificationsCreated } = checkResult.value;
            if (lowStockIngredients.length === 0) {
                return (0, result_1.ok)({
                    lowStockCount: 0,
                    criticalStockCount: 0,
                    emailsSent: 0,
                    notificationsCreated: 0,
                });
            }
            let emailsSent = 0;
            if (this.alertConfig.enableEmailAlerts &&
                this.alertConfig.recipients.length > 0) {
                const emailContent = this.createLowStockAlertContent(lowStockIngredients);
                for (const recipient of this.alertConfig.recipients) {
                    const emailResult = await this.emailService.send(recipient, emailContent);
                    if (emailResult.success)
                        emailsSent++;
                }
            }
            const criticalStockCount = lowStockIngredients.filter((ing) => ing.currentStock <= ing.minStock).length;
            return (0, result_1.ok)({
                lowStockCount: lowStockIngredients.length,
                criticalStockCount,
                emailsSent,
                notificationsCreated,
            });
        }
        catch (error) {
            return (0, result_1.err)(new Error(`Failed to check and alert low stock: ${error instanceof Error ? error.message : "Unknown error"}`));
        }
    }
    async sendRealTimeAlert(alertData) {
        if (!this.alertConfig.enableRealTimeAlerts)
            return;
        if (this.realTimeAlertQueue.length >= this.maxQueueSize) {
            console.warn(`Alert queue reached max size (${this.maxQueueSize}). Dropping oldest alert to prevent memory leak.`);
            this.realTimeAlertQueue.shift();
        }
        this.realTimeAlertQueue.push(alertData);
        if (!this.isProcessingAlerts) {
            this.isProcessingAlerts = true;
            setTimeout(() => this.processRealTimeAlerts(), 1000);
        }
    }
    async processRealTimeAlerts() {
        try {
            const batchSize = 100;
            let processed = 0;
            while (this.realTimeAlertQueue.length > 0 && processed < batchSize) {
                const alert = this.realTimeAlertQueue.shift();
                if (!alert)
                    break;
                try {
                    const emailContent = this.createRealTimeAlertContent([
                        {
                            ingredientName: alert.ingredientName,
                            currentStock: alert.currentStock,
                            minStock: alert.minStock,
                            unit: alert.unit,
                        },
                    ]);
                    for (const recipient of this.alertConfig.recipients) {
                        await this.emailService.send(recipient, Object.assign(Object.assign({}, emailContent), { subject: `URGENT: ${alert.ingredientName} is running low!` }));
                    }
                }
                catch (error) {
                    console.error("Real-time alert worker encountered an error for ingredient:", alert.ingredientName, error);
                }
                processed++;
            }
            if (this.realTimeAlertQueue.length > 0) {
                setTimeout(() => this.processRealTimeAlerts(), 500);
            }
            else {
                this.isProcessingAlerts = false;
            }
        }
        catch (error) {
            console.error("Critical failure in processRealTimeAlerts:", error);
            this.isProcessingAlerts = false;
        }
    }
    startAutomaticAlerts() {
        if (this.alertCheckInterval) {
            clearInterval(this.alertCheckInterval);
        }
        this.alertCheckInterval = setInterval(async () => {
            await this.checkAndAlertLowStock();
        }, this.alertConfig.checkIntervalMinutes * 60 * 1000);
        if (this.alertCheckInterval.unref) {
            this.alertCheckInterval.unref();
        }
        this.checkAndAlertLowStock();
    }
    stopAutomaticAlerts() {
        if (this.alertCheckInterval) {
            clearInterval(this.alertCheckInterval);
            this.alertCheckInterval = undefined;
        }
        this.realTimeAlertQueue = [];
        this.isProcessingAlerts = false;
    }
    createLowStockAlertContent(ingredients) {
        const criticalItems = ingredients.filter((i) => i.currentStock <= i.minStock);
        const lowItems = ingredients.filter((i) => i.currentStock > i.minStock && i.currentStock <= i.reorderPoint);
        const criticalList = criticalItems
            .map((i) => `${i.name}: ${i.currentStock}${i.unit} (Min: ${i.minStock}${i.unit}) - CRITICAL`)
            .join("\n");
        const lowList = lowItems
            .map((i) => `${i.name}: ${i.currentStock}${i.unit} (Reorder at: ${i.reorderPoint}${i.unit})`)
            .join("\n");
        const itemsList = `${criticalList}${criticalList && lowList ? "\n\n" : ""}${lowList}`;
        return {
            subject: `Low Stock Alert - ${ingredients.length} Item(s) Need Attention`,
            body: `The following ingredients are running low on stock:\n\n${itemsList}\n\nPlease replenish these items as soon as possible.\n\nTimestamp: ${new Date().toLocaleString()}`,
            isHtml: false,
        };
    }
    createRealTimeAlertContent(ingredients) {
        const itemsList = ingredients
            .map((n) => `• ${n.ingredientName}: ${n.currentStock}${n.unit} remaining (Min: ${n.minStock}${n.unit})`)
            .join("\n");
        return {
            subject: `Real-time Low Stock Alert`,
            body: `An ingredient has reached low stock levels:\n\n${itemsList}\n\nThis alert was triggered by recent sales activity.\n\nTimestamp: ${new Date().toLocaleString()}`,
            isHtml: false,
        };
    }
}
exports.InventoryManager = InventoryManager;
//# sourceMappingURL=inventory-manager.js.map