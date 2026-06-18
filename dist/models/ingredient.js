"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuItem = exports.Ingredient = void 0;
const result_1 = require("../shared/result");
class Ingredient {
    constructor(id, name, description, unit, currentStock, minStock, reorderPoint, costPerUnit, supplierId, category, shelfLife, isActive = true, lastRestocked, lastConsumed) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.unit = unit;
        this.currentStock = currentStock;
        this.minStock = minStock;
        this.reorderPoint = reorderPoint;
        this.costPerUnit = costPerUnit;
        this.supplierId = supplierId;
        this.category = category;
        this.shelfLife = shelfLife;
        this.isActive = isActive;
        this.lastRestocked = lastRestocked;
        this.lastConsumed = lastConsumed;
    }
    static create(id, name, description, unit, currentStock, minStock, reorderPoint, costPerUnit, supplierId, category, shelfLife, isActive = true) {
        if (!name || name.trim().length === 0) {
            return (0, result_1.err)(new Error("Ingredient name is required"));
        }
        if (unit.trim().length === 0) {
            return (0, result_1.err)(new Error("Unit is required"));
        }
        if (currentStock < 0) {
            return (0, result_1.err)(new Error("Current stock cannot be negative"));
        }
        if (minStock < 0) {
            return (0, result_1.err)(new Error("Minimum stock cannot be negative"));
        }
        if (reorderPoint < 0) {
            return (0, result_1.err)(new Error("Reorder point cannot be negative"));
        }
        if (reorderPoint < minStock) {
            return (0, result_1.err)(new Error("Reorder point must be greater than or equal to minimum stock"));
        }
        if (costPerUnit <= 0) {
            return (0, result_1.err)(new Error("Cost per unit must be positive"));
        }
        if (!supplierId) {
            return (0, result_1.err)(new Error("Supplier ID is required"));
        }
        return (0, result_1.ok)(new Ingredient(id, name.trim(), description.trim(), unit.trim(), currentStock, minStock, reorderPoint, costPerUnit, supplierId, category.trim(), shelfLife, isActive));
    }
    isLowStock() {
        return this.currentStock <= this.minStock;
    }
    needsReorder() {
        return this.currentStock <= this.reorderPoint;
    }
    getStock() {
        return this.currentStock;
    }
    getStockLevel() {
        if (this.currentStock <= this.minStock)
            return "CRITICAL";
        if (this.currentStock <= this.reorderPoint)
            return "LOW";
        return "NORMAL";
    }
    consume(quantity) {
        if (quantity <= 0) {
            return (0, result_1.err)(new Error("Consumption quantity must be positive"));
        }
        if (quantity > this.currentStock) {
            return (0, result_1.err)(new Error(`Insufficient stock. Available: ${this.currentStock}${this.unit}, Required: ${quantity}${this.unit}`));
        }
        this.currentStock -= quantity;
        return (0, result_1.ok)(this);
    }
    replenish(quantity) {
        if (quantity <= 0) {
            return (0, result_1.err)(new Error("Replenishment quantity must be positive"));
        }
        this.currentStock += quantity;
        return (0, result_1.ok)(this);
    }
    setStock(newStock) {
        if (newStock < 0) {
            return (0, result_1.err)(new Error("Stock cannot be negative"));
        }
        this.currentStock = newStock;
        return (0, result_1.ok)(this);
    }
    calculateCost(quantity) {
        return this.costPerUnit * quantity;
    }
}
exports.Ingredient = Ingredient;
class MenuItem {
    constructor(id, name, description, price, categoryId, ingredientReferences, preparationTime, isActive = true, costPrice, profitMargin) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.price = price;
        this.categoryId = categoryId;
        this.ingredientReferences = ingredientReferences;
        this.preparationTime = preparationTime;
        this.isActive = isActive;
        this.costPrice = costPrice;
        this.profitMargin = profitMargin;
    }
    static create(id, name, description, price, categoryId, ingredientReferences, preparationTime, isActive = true, costPrice, profitMargin) {
        if (!name || name.trim().length === 0) {
            return (0, result_1.err)(new Error("Menu item name is required"));
        }
        if (price <= 0) {
            return (0, result_1.err)(new Error("Price must be positive"));
        }
        if (!categoryId) {
            return (0, result_1.err)(new Error("Category ID is required"));
        }
        if (preparationTime <= 0) {
            return (0, result_1.err)(new Error("Preparation time must be positive"));
        }
        for (const ref of ingredientReferences) {
            if (!ref.ingredientId) {
                return (0, result_1.err)(new Error("Ingredient ID is required in references"));
            }
            if (ref.quantity <= 0) {
                return (0, result_1.err)(new Error("Ingredient quantity must be positive"));
            }
            if (!ref.unit || ref.unit.trim().length === 0) {
                return (0, result_1.err)(new Error("Ingredient unit is required"));
            }
        }
        return (0, result_1.ok)(new MenuItem(id, name.trim(), description.trim(), price, categoryId, ingredientReferences, preparationTime, isActive, costPrice, profitMargin));
    }
    getRequiredIngredients() {
        return [...this.ingredientReferences];
    }
    calculateTotalCost(ingredients) {
        let totalCost = 0;
        for (const ref of this.ingredientReferences) {
            const ingredient = ingredients.get(ref.ingredientId);
            if (ingredient) {
                totalCost += ingredient.calculateCost(ref.quantity);
            }
        }
        return totalCost;
    }
}
exports.MenuItem = MenuItem;
//# sourceMappingURL=ingredient.js.map