"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryEndpoints = void 0;
const result_1 = require("../shared/result");
const mongoose_1 = __importDefault(require("mongoose"));
const dependencies_1 = require("../config/dependencies");
const ingredient_1 = require("../models/ingredient");
const serializeIngredient = (ing) => ({
    id: ing.id,
    name: ing.name,
    description: ing.description,
    unit: ing.unit,
    currentStock: ing.getStock(),
    minStock: ing.minStock,
    reorderPoint: ing.reorderPoint,
    costPerUnit: ing.costPerUnit,
    category: ing.category,
    supplierId: ing.supplierId,
    shelfLife: ing.shelfLife,
    isActive: ing.isActive,
    status: ing.getStockLevel(),
    isLowStock: ing.isLowStock(),
    needsReorder: ing.needsReorder(),
});
class InventoryEndpoints {
    constructor() {
        const container = dependencies_1.DependencyContainer.getInstance();
        this.inventoryManager = container.resolve("InventoryManager");
        this.ingredientRepository = container.resolve("IngredientRepository");
        this.menuItemRepository = container.resolve("MenuItemRepository");
    }
    async getDependencies() {
        if (!this.inventoryManager ||
            !this.ingredientRepository ||
            !this.menuItemRepository) {
            const container = dependencies_1.DependencyContainer.getInstance();
            this.inventoryManager = container.resolve("InventoryManager");
            this.ingredientRepository = container.resolve("IngredientRepository");
            this.menuItemRepository = container.resolve("MenuItemRepository");
        }
        return {
            inventoryManager: this.inventoryManager,
            ingredientRepository: this.ingredientRepository,
            menuItemRepository: this.menuItemRepository,
        };
    }
    async checkAvailability(req, res) {
        try {
            const { items } = req.body;
            if (!Array.isArray(items) || items.length === 0) {
                res.status(400).json({
                    success: false,
                    message: "Items array is required",
                });
                return;
            }
            const { menuItemRepository, ingredientRepository } = await this.getDependencies();
            const results = [];
            for (const item of items) {
                const { menuItemId, quantity } = item;
                const menuItemResult = await menuItemRepository.findById(menuItemId);
                if (!menuItemResult.success || !menuItemResult.value) {
                    results.push({
                        menuItemId,
                        menuItemName: "Unknown",
                        available: false,
                        missingIngredients: ["Menu item not found"],
                    });
                    continue;
                }
                const menuItem = menuItemResult.value;
                const missingIngredients = [];
                for (const ref of menuItem.getRequiredIngredients()) {
                    const ingredientResult = await ingredientRepository.findById(ref.ingredientId);
                    if (!ingredientResult.success || !ingredientResult.value) {
                        missingIngredients.push(`Ingredient ${ref.ingredientId} not found`);
                        continue;
                    }
                    const ingredient = ingredientResult.value;
                    const requiredAmount = ref.quantity * quantity;
                    if (ingredient.getStock() < requiredAmount) {
                        missingIngredients.push(`${ingredient.name}: Need ${requiredAmount}${ingredient.unit}, have ${ingredient.getStock()}${ingredient.unit}`);
                    }
                }
                results.push({
                    menuItemId,
                    menuItemName: menuItem.name,
                    available: missingIngredients.length === 0,
                    missingIngredients: missingIngredients.length > 0 ? missingIngredients : undefined,
                });
            }
            res.json((0, result_1.ok)(results));
        }
        catch (error) {
            console.error("Error checking availability:", error);
            res.status(500).json({ message: "Server error", error });
        }
    }
    async consumeIngredients(req, res) {
        try {
            const { requests } = req.body;
            const { inventoryManager, ingredientRepository, menuItemRepository } = await this.getDependencies();
            if (!Array.isArray(requests) || requests.length === 0) {
                res.status(400).json({
                    ok: false,
                    error: "Requests array is required",
                });
                return;
            }
            const ingredientRequirements = new Map();
            for (const req of requests) {
                const { menuItemId, quantity } = req;
                const menuItemResult = await menuItemRepository.findById(menuItemId);
                if (!menuItemResult.success || !menuItemResult.value)
                    continue;
                const menuItem = menuItemResult.value;
                for (const ref of menuItem.getRequiredIngredients()) {
                    const current = ingredientRequirements.get(ref.ingredientId) || 0;
                    ingredientRequirements.set(ref.ingredientId, current + ref.quantity * quantity);
                }
            }
            const allDeductionResults = [];
            for (const req of requests) {
                const items = [{ menuItemId: req.menuItemId, quantity: req.quantity }];
                const result = await inventoryManager.processOrder(items);
                if (!result.success)
                    continue;
                for (const consumption of result.value.consumedIngredients) {
                    const ingredientResult = await ingredientRepository.findById(consumption.ingredientId);
                    if (ingredientResult.success && ingredientResult.value) {
                        const ingredient = ingredientResult.value;
                        const existingIndex = allDeductionResults.findIndex((r) => r.ingredientId === consumption.ingredientId);
                        if (existingIndex >= 0) {
                            allDeductionResults[existingIndex].consumedQuantity +=
                                consumption.consumedQuantity;
                            allDeductionResults[existingIndex].remainingStock =
                                ingredient.getStock();
                        }
                        else {
                            allDeductionResults.push({
                                ingredientId: consumption.ingredientId,
                                ingredientName: ingredient.name,
                                consumedQuantity: consumption.consumedQuantity,
                                remainingStock: consumption.remainingStock,
                                unit: ingredient.unit,
                                isLowStock: consumption.isLowStock,
                                needsReorder: consumption.needsReorder,
                                reorderPoint: ingredient.reorderPoint,
                            });
                        }
                    }
                }
            }
            res.json({
                ok: true,
                value: allDeductionResults,
            });
        }
        catch (error) {
            console.error("Error consuming ingredients:", error);
            res.status(500).json({
                ok: false,
                error: error instanceof Error ? error.message : "Server error",
            });
        }
    }
    async previewDeduction(req, res) {
        try {
            const { requests } = req.body;
            const { menuItemRepository, ingredientRepository } = await this.getDependencies();
            if (!Array.isArray(requests) || requests.length === 0) {
                res.status(400).json({
                    ok: false,
                    error: "Requests array is required",
                });
                return;
            }
            const ingredientMap = new Map();
            for (const req of requests) {
                const { menuItemId, quantity } = req;
                const menuItemResult = await menuItemRepository.findById(menuItemId);
                if (!menuItemResult.success || !menuItemResult.value)
                    continue;
                const menuItem = menuItemResult.value;
                for (const ref of menuItem.getRequiredIngredients()) {
                    const ingredientResult = await ingredientRepository.findById(ref.ingredientId);
                    if (!ingredientResult.success || !ingredientResult.value)
                        continue;
                    const ingredient = ingredientResult.value;
                    const consumedQuantity = ref.quantity * quantity;
                    const ingredientId = ingredient.id;
                    if (ingredientMap.has(ingredientId)) {
                        ingredientMap.get(ingredientId).consumedQuantity +=
                            consumedQuantity;
                    }
                    else {
                        ingredientMap.set(ingredientId, {
                            ingredientId,
                            ingredientName: ingredient.name,
                            consumedQuantity,
                            unit: ingredient.unit,
                            currentStock: ingredient.getStock(),
                            reorderPoint: ingredient.reorderPoint,
                            minStock: ingredient.minStock,
                        });
                    }
                }
            }
            const previews = Array.from(ingredientMap.values()).map((item) => {
                const remainingStock = item.currentStock - item.consumedQuantity;
                return {
                    ingredientId: item.ingredientId,
                    ingredientName: item.ingredientName,
                    consumedQuantity: item.consumedQuantity,
                    remainingStock,
                    unit: item.unit,
                    isLowStock: remainingStock <= item.minStock,
                    needsReorder: remainingStock <= item.reorderPoint,
                    reorderPoint: item.reorderPoint,
                };
            });
            res.json({
                ok: true,
                value: previews,
            });
        }
        catch (error) {
            console.error("Error previewing deduction:", error);
            res.status(500).json({
                ok: false,
                error: error instanceof Error ? error.message : "Server error",
            });
        }
    }
    async getStockLevels(req, res) {
        try {
            const { ingredientRepository } = await this.getDependencies();
            const result = await this.ingredientRepository.findAll();
            if (!result.success) {
                res.status(404).json({ message: "Stock not found" });
                return;
            }
            const stockLevels = result.value.map((ing) => ({
                id: ing.id,
                name: ing.name,
                currentStock: ing.getStock(),
                minStock: ing.minStock,
                reorderPoint: ing.reorderPoint,
                unit: ing.unit,
                status: ing.getStockLevel(),
                isLowStock: ing.isLowStock(),
                needsReorder: ing.needsReorder(),
                costPerUnit: ing.costPerUnit,
                category: ing.category,
            }));
            res.json((0, result_1.ok)({
                stockLevels,
                summary: {
                    total: result.value.length,
                    lowStock: result.value.filter((i) => i.isLowStock()).length,
                    needsReorder: result.value.filter((i) => i.needsReorder()).length,
                },
            }));
        }
        catch (error) {
            res.status(500).json({ message: "Server error", error });
        }
    }
    async getDashboardData(req, res) {
        try {
            const stockResult = await this.ingredientRepository.findAll();
            if (!stockResult.success || !stockResult.value) {
                res.status(404).json({
                    ok: false,
                    error: "No inventory data found",
                });
                return;
            }
            const ingredients = stockResult.value;
            const criticalItems = ingredients.filter((i) => i.isLowStock());
            const lowItems = ingredients.filter((i) => i.needsReorder() && !i.isLowStock());
            const totalValue = ingredients.reduce((sum, ing) => {
                return sum + ing.getStock() * ing.costPerUnit;
            }, 0);
            const menuItemResult = await this.menuItemRepository.findAllActive();
            const usedInMap = new Map();
            if (menuItemResult.success && menuItemResult.value) {
                for (const menuItem of menuItemResult.value) {
                    for (const ref of menuItem.getRequiredIngredients()) {
                        if (!usedInMap.has(ref.ingredientId)) {
                            usedInMap.set(ref.ingredientId, []);
                        }
                        usedInMap.get(ref.ingredientId).push({
                            menuItemId: menuItem.id,
                            menuItemName: menuItem.name,
                            quantityRequired: ref.quantity,
                            unit: ref.unit,
                        });
                    }
                }
            }
            const ingredientsWithUsage = ingredients.map((ing) => ({
                id: ing.id,
                name: ing.name,
                currentStock: ing.getStock(),
                unit: ing.unit,
                minStock: ing.minStock,
                reorderPoint: ing.reorderPoint,
                costPerUnit: ing.costPerUnit,
                isLowStock: ing.isLowStock(),
                needsReorder: ing.needsReorder(),
                usedIn: usedInMap.get(ing.id) || [],
            }));
            res.json({
                ok: true,
                value: {
                    inventory: {
                        totalItems: ingredients.length,
                        criticalItems: criticalItems.length,
                        lowItems: lowItems.length,
                        normalItems: ingredients.length - criticalItems.length - lowItems.length,
                        totalValue: parseFloat(totalValue.toFixed(2)),
                        ingredients: ingredientsWithUsage,
                    },
                    alerts: {
                        enabled: true,
                        checkInterval: 60,
                    },
                },
            });
        }
        catch (error) {
            console.error("Error getting dashboard data:", error);
            res.status(500).json({
                ok: false,
                error: error instanceof Error ? error.message : "An unknown error occurred",
            });
        }
    }
    async bulkUpdate(req, res) {
        try {
            const { updates } = req.body;
            const { ingredientRepository } = await this.getDependencies();
            if (!Array.isArray(updates) || updates.length === 0) {
                res.status(400).json({
                    ok: false,
                    error: "Updates array is required",
                });
                return;
            }
            const results = [];
            for (const update of updates) {
                const { ingredientId, newStock } = update;
                const ingredientResult = await this.ingredientRepository.findById(ingredientId);
                if (!ingredientResult.success || !ingredientResult.value) {
                    results.push({
                        ingredientId,
                        success: false,
                        error: "Ingredient not found",
                    });
                    continue;
                }
                const ingredient = ingredientResult.value;
                const setResult = ingredient.setStock(newStock);
                if (!setResult.success) {
                    results.push({
                        ingredientId,
                        success: false,
                        error: setResult.error.message,
                    });
                    continue;
                }
                const saveResult = await this.ingredientRepository.save(setResult.value);
                if (!saveResult.success) {
                    results.push({
                        ingredientId,
                        success: false,
                        error: saveResult.error.message,
                    });
                    continue;
                }
                results.push({
                    ingredientId,
                    success: true,
                });
            }
            res.json({
                ok: true,
                value: results,
            });
        }
        catch (error) {
            console.error("Error in bulk update:", error);
            res.status(500).json({
                ok: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    async updateStock(req, res) {
        try {
            const { ingredientId, newStock } = req.body;
            const { ingredientRepository } = await this.getDependencies();
            if (!ingredientId || newStock === undefined) {
                res.status(400).json({
                    ok: false,
                    error: "ingredientId and newStock are required",
                });
                return;
            }
            const ingredientResult = await this.ingredientRepository.findById(ingredientId);
            if (!ingredientResult.success || !ingredientResult.value) {
                res.status(404).json({
                    ok: false,
                    error: "Ingredient not found",
                });
                return;
            }
            const ingredient = ingredientResult.value;
            const setResult = ingredient.setStock(newStock);
            if (!setResult.success) {
                res.status(400).json({
                    ok: false,
                    error: setResult.error.message,
                });
                return;
            }
            const saveResult = await this.ingredientRepository.save(setResult.value);
            if (!saveResult.success) {
                res.status(500).json({
                    ok: false,
                    error: saveResult.error.message,
                });
                return;
            }
            res.json({
                ok: true,
                value: {
                    success: true,
                    message: "Stock updated successfully",
                    ingredient: {
                        id: saveResult.value.id,
                        name: saveResult.value.name,
                        currentStock: saveResult.value.getStock(),
                        unit: saveResult.value.unit,
                    },
                },
            });
        }
        catch (error) {
            console.error("Error updating stock:", error);
            res.status(500).json({
                ok: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    async reorderIngredient(req, res) {
        try {
            const { ingredientId, quantity } = req.body;
            await this.getDependencies();
            if (!ingredientId) {
                res.status(400).json({
                    ok: false,
                    error: "ingredientId is required",
                });
                return;
            }
            console.log(`Reorder requested for ingredient ${ingredientId}, quantity: ${quantity || "default"}`);
            const reorderId = `REORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            res.json({
                ok: true,
                value: {
                    success: true,
                    message: "Reorder request submitted",
                    reorderId,
                    timestamp: new Date().toISOString(),
                },
            });
        }
        catch (error) {
            console.error("Error creating reorder:", error);
            res.status(500).json({
                ok: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    async getLowStockAlerts(req, res) {
        try {
            const result = await this.ingredientRepository.findLowStockIngredients();
            const { ingredientRepository } = await this.getDependencies();
            if (!result.success) {
                res.status(500).json({
                    ok: false,
                    error: result.error.message,
                });
                return;
            }
            const alerts = result.value.map((ingredient) => ({
                ingredientId: ingredient.id,
                ingredientName: ingredient.name,
                consumedQuantity: 0,
                remainingStock: ingredient.getStock(),
                unit: ingredient.unit,
                isLowStock: ingredient.isLowStock(),
                needsReorder: ingredient.needsReorder(),
            }));
            res.json({
                ok: true,
                value: alerts,
            });
        }
        catch (error) {
            console.error("Error getting low stock alerts:", error);
            res.status(500).json({
                ok: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    async listIngredients(req, res) {
        try {
            await this.getDependencies();
            const result = await this.ingredientRepository.findAll();
            if (!result.success) {
                res.status(500).json({ ok: false, error: "Failed to load ingredients" });
                return;
            }
            res.json({ ok: true, value: result.value.map(serializeIngredient) });
        }
        catch (error) {
            console.error("Error listing ingredients:", error);
            res.status(500).json({ ok: false, error: "Server error" });
        }
    }
    async createIngredient(req, res) {
        try {
            await this.getDependencies();
            const { name, description = "", unit, currentStock = 0, minStock, reorderPoint, costPerUnit, supplierId, category = "", shelfLife, } = req.body;
            const id = new mongoose_1.default.Types.ObjectId().toString();
            const created = ingredient_1.Ingredient.create(id, name, description, unit, Number(currentStock), Number(minStock), Number(reorderPoint), Number(costPerUnit), supplierId, category, shelfLife !== undefined ? Number(shelfLife) : undefined, true);
            if (!created.success) {
                res.status(400).json({ ok: false, error: created.error.message });
                return;
            }
            const saved = await this.ingredientRepository.save(created.value);
            if (!saved.success) {
                res.status(500).json({ ok: false, error: "Failed to save ingredient" });
                return;
            }
            res.status(201).json({ ok: true, value: serializeIngredient(saved.value) });
        }
        catch (error) {
            console.error("Error creating ingredient:", error);
            res.status(500).json({ ok: false, error: "Server error" });
        }
    }
    async updateIngredient(req, res) {
        var _a, _b, _c, _d, _e;
        try {
            await this.getDependencies();
            const id = req.params.id;
            const existing = await this.ingredientRepository.findById(id);
            if (!existing.success || !existing.value) {
                res.status(404).json({ ok: false, error: "Ingredient not found" });
                return;
            }
            const current = existing.value;
            const body = req.body;
            const updated = ingredient_1.Ingredient.create(current.id, (_a = body.name) !== null && _a !== void 0 ? _a : current.name, (_b = body.description) !== null && _b !== void 0 ? _b : current.description, (_c = body.unit) !== null && _c !== void 0 ? _c : current.unit, current.getStock(), body.minStock !== undefined ? Number(body.minStock) : current.minStock, body.reorderPoint !== undefined
                ? Number(body.reorderPoint)
                : current.reorderPoint, body.costPerUnit !== undefined
                ? Number(body.costPerUnit)
                : current.costPerUnit, (_d = body.supplierId) !== null && _d !== void 0 ? _d : current.supplierId, (_e = body.category) !== null && _e !== void 0 ? _e : current.category, body.shelfLife !== undefined ? Number(body.shelfLife) : current.shelfLife, body.isActive !== undefined ? Boolean(body.isActive) : current.isActive);
            if (!updated.success) {
                res.status(400).json({ ok: false, error: updated.error.message });
                return;
            }
            const saved = await this.ingredientRepository.save(updated.value);
            if (!saved.success) {
                res.status(500).json({ ok: false, error: "Failed to update ingredient" });
                return;
            }
            res.json({ ok: true, value: serializeIngredient(saved.value) });
        }
        catch (error) {
            console.error("Error updating ingredient:", error);
            res.status(500).json({ ok: false, error: "Server error" });
        }
    }
    async deleteIngredient(req, res) {
        try {
            await this.getDependencies();
            const id = req.params.id;
            const existing = await this.ingredientRepository.findById(id);
            if (!existing.success || !existing.value) {
                res.status(404).json({ ok: false, error: "Ingredient not found" });
                return;
            }
            const current = existing.value;
            const deactivated = ingredient_1.Ingredient.create(current.id, current.name, current.description, current.unit, current.getStock(), current.minStock, current.reorderPoint, current.costPerUnit, current.supplierId, current.category, current.shelfLife, false);
            if (!deactivated.success) {
                res.status(400).json({ ok: false, error: deactivated.error.message });
                return;
            }
            const saved = await this.ingredientRepository.save(deactivated.value);
            if (!saved.success) {
                res.status(500).json({ ok: false, error: "Failed to delete ingredient" });
                return;
            }
            res.json({ ok: true, value: { success: true, id } });
        }
        catch (error) {
            console.error("Error deleting ingredient:", error);
            res.status(500).json({ ok: false, error: "Server error" });
        }
    }
    async adjustStock(req, res) {
        try {
            await this.getDependencies();
            const id = req.params.id;
            const { delta, reason } = req.body;
            const deltaNum = Number(delta);
            if (!Number.isFinite(deltaNum) || deltaNum === 0) {
                res.status(400).json({ ok: false, error: "A non-zero delta is required" });
                return;
            }
            const existing = await this.ingredientRepository.findById(id);
            if (!existing.success || !existing.value) {
                res.status(404).json({ ok: false, error: "Ingredient not found" });
                return;
            }
            const ingredient = existing.value;
            const newStock = ingredient.getStock() + deltaNum;
            const setResult = ingredient.setStock(newStock);
            if (!setResult.success) {
                res.status(400).json({ ok: false, error: setResult.error.message });
                return;
            }
            const saved = await this.ingredientRepository.save(setResult.value);
            if (!saved.success) {
                res.status(500).json({ ok: false, error: "Failed to adjust stock" });
                return;
            }
            console.log(`Stock adjusted: ${ingredient.name} ${deltaNum > 0 ? "+" : ""}${deltaNum}${ingredient.unit} (reason: ${reason || "n/a"})`);
            res.json({ ok: true, value: serializeIngredient(saved.value) });
        }
        catch (error) {
            console.error("Error adjusting stock:", error);
            res.status(500).json({ ok: false, error: "Server error" });
        }
    }
}
exports.InventoryEndpoints = InventoryEndpoints;
//# sourceMappingURL=inventoryController.js.map