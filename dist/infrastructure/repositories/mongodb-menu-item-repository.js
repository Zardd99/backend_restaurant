"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoDBMenuItemRepository = void 0;
const ingredient_1 = require("../../models/ingredient");
const result_1 = require("../../shared/result");
class MongoDBMenuItemRepository {
    constructor(menuItemModel) {
        this.menuItemModel = menuItemModel;
    }
    async findById(id) {
        var _a;
        try {
            const doc = await this.menuItemModel
                .findById(id)
                .populate("ingredientReferences.ingredient", "name unit costPerUnit")
                .lean()
                .exec();
            if (!doc) {
                return (0, result_1.ok)(null);
            }
            const ingredientReferences = ((_a = doc.ingredientReferences) === null || _a === void 0 ? void 0 : _a.map((ref) => {
                var _a, _b, _c;
                return ({
                    ingredientId: ((_b = (_a = ref.ingredient) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) || "",
                    quantity: ref.quantity || 0,
                    unit: ref.unit || ((_c = ref.ingredient) === null || _c === void 0 ? void 0 : _c.unit) || "unit",
                });
            })) || [];
            return ingredient_1.MenuItem.create(doc._id.toString(), doc.name, doc.description || "", doc.price, doc.category ? doc.category.toString() : "", ingredientReferences, doc.preparationTime || 15, doc.availability !== false, doc.costPrice, doc.profitMargin);
        }
        catch (error) {
            return (0, result_1.err)(new Error(`Failed to find menu item: ${error instanceof Error ? error.message : "Unknown error"}`));
        }
    }
    async findByIds(ids) {
        var _a;
        try {
            const docs = await this.menuItemModel
                .find({ _id: { $in: ids } })
                .populate("ingredientReferences.ingredient", "name unit costPerUnit")
                .lean()
                .exec();
            const menuItems = [];
            for (const doc of docs) {
                const ingredientReferences = ((_a = doc.ingredientReferences) === null || _a === void 0 ? void 0 : _a.map((ref) => {
                    var _a, _b, _c;
                    return ({
                        ingredientId: ((_b = (_a = ref.ingredient) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) || "",
                        quantity: ref.quantity || 0,
                        unit: ref.unit || ((_c = ref.ingredient) === null || _c === void 0 ? void 0 : _c.unit) || "unit",
                    });
                })) || [];
                const menuItemResult = ingredient_1.MenuItem.create(doc._id.toString(), doc.name, doc.description || "", doc.price, doc.category ? doc.category.toString() : "", ingredientReferences, doc.preparationTime || 15, doc.availability !== false, doc.costPrice, doc.profitMargin);
                if (menuItemResult.success) {
                    menuItems.push(menuItemResult.value);
                }
            }
            return (0, result_1.ok)(menuItems);
        }
        catch (error) {
            return (0, result_1.err)(new Error(`Failed to find menu items: ${error instanceof Error ? error.message : "Unknown error"}`));
        }
    }
    async findAllActive() {
        var _a;
        try {
            const docs = await this.menuItemModel
                .find({ availability: true })
                .populate("ingredientReferences.ingredient", "name unit costPerUnit")
                .lean()
                .exec();
            const menuItems = [];
            for (const doc of docs) {
                const ingredientReferences = ((_a = doc.ingredientReferences) === null || _a === void 0 ? void 0 : _a.map((ref) => {
                    var _a, _b, _c;
                    return ({
                        ingredientId: ((_b = (_a = ref.ingredient) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) || "",
                        quantity: ref.quantity || 0,
                        unit: ref.unit || ((_c = ref.ingredient) === null || _c === void 0 ? void 0 : _c.unit) || "unit",
                    });
                })) || [];
                const menuItemResult = ingredient_1.MenuItem.create(doc._id.toString(), doc.name, doc.description || "", doc.price, doc.category ? doc.category.toString() : "", ingredientReferences, doc.preparationTime || 15, doc.availability !== false, doc.costPrice, doc.profitMargin);
                if (menuItemResult.success) {
                    menuItems.push(menuItemResult.value);
                }
            }
            return (0, result_1.ok)(menuItems);
        }
        catch (error) {
            return (0, result_1.err)(new Error(`Failed to find menu items: ${error instanceof Error ? error.message : "Unknown error"}`));
        }
    }
    async save(menuItem) {
        var _a;
        try {
            const updateData = {
                name: menuItem.name,
                description: menuItem.description,
                price: menuItem.price,
                category: menuItem.categoryId,
                ingredientReferences: menuItem.getRequiredIngredients().map(ref => ({
                    ingredient: ref.ingredientId,
                    quantity: ref.quantity,
                    unit: ref.unit,
                })),
                preparationTime: menuItem.preparationTime,
                availability: menuItem.isActive,
                costPrice: menuItem.costPrice,
                profitMargin: menuItem.profitMargin,
            };
            const doc = await this.menuItemModel
                .findByIdAndUpdate(menuItem.id, updateData, {
                new: true,
                upsert: true,
                lean: true
            })
                .populate("ingredientReferences.ingredient", "name unit costPerUnit")
                .exec();
            if (!doc) {
                return (0, result_1.err)(new Error("Failed to save menu item"));
            }
            const ingredientReferences = ((_a = doc.ingredientReferences) === null || _a === void 0 ? void 0 : _a.map((ref) => {
                var _a, _b, _c;
                return ({
                    ingredientId: ((_b = (_a = ref.ingredient) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) || "",
                    quantity: ref.quantity || 0,
                    unit: ref.unit || ((_c = ref.ingredient) === null || _c === void 0 ? void 0 : _c.unit) || "unit",
                });
            })) || [];
            return ingredient_1.MenuItem.create(doc._id.toString(), doc.name, doc.description || "", doc.price, doc.category ? doc.category.toString() : "", ingredientReferences, doc.preparationTime || 15, doc.availability !== false, doc.costPrice, doc.profitMargin);
        }
        catch (error) {
            return (0, result_1.err)(new Error(`Failed to save menu item: ${error instanceof Error ? error.message : "Unknown error"}`));
        }
    }
}
exports.MongoDBMenuItemRepository = MongoDBMenuItemRepository;
//# sourceMappingURL=mongodb-menu-item-repository.js.map