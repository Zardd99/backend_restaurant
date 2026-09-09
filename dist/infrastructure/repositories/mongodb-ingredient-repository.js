"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoDBIngredientRepository = void 0;
const ingredient_1 = require("../../models/ingredient");
const result_1 = require("../../shared/result");
const mongoose_1 = __importDefault(require("mongoose"));
class MongoDBIngredientRepository {
    constructor(ingredientModel) {
        this.ingredientModel = ingredientModel;
    }
    async findById(id) {
        try {
            const doc = await this.ingredientModel.findById(id).lean();
            if (!doc) {
                return (0, result_1.ok)(null);
            }
            return ingredient_1.Ingredient.create(doc._id.toString(), doc.name, doc.description, doc.unit, doc.currentStock, doc.minStock, doc.reorderPoint || doc.minStock * 1.5, doc.costPerUnit, doc.supplier, doc.category, doc.shelfLife, doc.isActive);
        }
        catch (error) {
            return (0, result_1.err)(new Error(`Failed to find ingredient: ${error instanceof Error ? error.message : "Unknown error"}`));
        }
    }
    async findByIds(ids) {
        try {
            const docs = await this.ingredientModel
                .find({
                _id: { $in: ids },
            })
                .lean();
            const ingredients = [];
            for (const doc of docs) {
                const ingredientResult = ingredient_1.Ingredient.create(doc._id.toString(), doc.name, doc.description, doc.unit, doc.currentStock, doc.minStock, doc.reorderPoint || doc.minStock * 1.5, doc.costPerUnit, doc.supplier, doc.category, doc.shelfLife, doc.isActive);
                if (ingredientResult.success) {
                    ingredients.push(ingredientResult.value);
                }
            }
            return (0, result_1.ok)(ingredients);
        }
        catch (error) {
            return (0, result_1.err)(new Error(`Failed to find ingredients: ${error instanceof Error ? error.message : "Unknown error"}`));
        }
    }
    async findAll() {
        try {
            const docs = await this.ingredientModel.find({ isActive: true }).lean();
            const ingredients = [];
            for (const doc of docs) {
                const ingredientResult = ingredient_1.Ingredient.create(doc._id.toString(), doc.name, doc.description, doc.unit, doc.currentStock, doc.minStock, doc.reorderPoint || doc.minStock * 1.5, doc.costPerUnit, doc.supplier, doc.category, doc.shelfLife, doc.isActive);
                if (ingredientResult.success) {
                    ingredients.push(ingredientResult.value);
                }
            }
            return (0, result_1.ok)(ingredients);
        }
        catch (error) {
            return (0, result_1.err)(new Error(`Failed to find ingredients: ${error instanceof Error ? error.message : "Unknown error"}`));
        }
    }
    async save(ingredient) {
        try {
            const updateData = {
                name: ingredient.name,
                description: ingredient.description,
                unit: ingredient.unit,
                currentStock: ingredient.getStock(),
                minStock: ingredient.minStock,
                reorderPoint: ingredient.reorderPoint,
                costPerUnit: ingredient.costPerUnit,
                supplier: ingredient.supplierId,
                category: ingredient.category,
                shelfLife: ingredient.shelfLife,
                isActive: ingredient.isActive,
            };
            const doc = await this.ingredientModel
                .findByIdAndUpdate(ingredient.id, updateData, {
                new: true,
                upsert: true,
            })
                .lean();
            if (!doc) {
                return (0, result_1.err)(new Error("Failed to save ingredient"));
            }
            return ingredient_1.Ingredient.create(doc._id.toString(), doc.name, doc.description, doc.unit, doc.currentStock, doc.minStock, doc.reorderPoint || doc.minStock * 1.5, doc.costPerUnit, doc.supplier, doc.category, doc.shelfLife, doc.isActive);
        }
        catch (error) {
            return (0, result_1.err)(new Error(`Failed to save ingredient: ${error instanceof Error ? error.message : "Unknown error"}`));
        }
    }
    async findLowStockIngredients() {
        try {
            const docs = await this.ingredientModel
                .find({
                isActive: true,
                $expr: { $lte: ["$currentStock", "$reorderPoint"] },
            })
                .lean();
            const ingredients = [];
            for (const doc of docs) {
                const ingredientResult = ingredient_1.Ingredient.create(doc._id.toString(), doc.name, doc.description, doc.unit, doc.currentStock, doc.minStock, doc.reorderPoint || doc.minStock * 1.5, doc.costPerUnit, doc.supplier, doc.category, doc.shelfLife, doc.isActive);
                if (ingredientResult.success) {
                    ingredients.push(ingredientResult.value);
                }
            }
            return (0, result_1.ok)(ingredients);
        }
        catch (error) {
            return (0, result_1.err)(new Error(`Failed to find low stock ingredients: ${error instanceof Error ? error.message : "Unknown error"}`));
        }
    }
    async consumeAtomic(deductions, externalSession) {
        const apply = async (session) => {
            for (const deduction of deductions) {
                if (deduction.quantity <= 0) {
                    continue;
                }
                const result = await this.ingredientModel.updateOne({
                    _id: deduction.ingredientId,
                    isActive: true,
                    currentStock: { $gte: deduction.quantity },
                }, {
                    $inc: { currentStock: -deduction.quantity },
                    $set: { lastConsumed: new Date() },
                }, { session });
                if (result.modifiedCount !== 1) {
                    throw new Error(`INSUFFICIENT_STOCK:${deduction.ingredientId}`);
                }
            }
        };
        if (externalSession) {
            try {
                await apply(externalSession);
                return (0, result_1.ok)(undefined);
            }
            catch (error) {
                return (0, result_1.err)(error instanceof Error
                    ? error
                    : new Error("Failed to consume ingredients atomically"));
            }
        }
        const session = await mongoose_1.default.startSession();
        try {
            await session.withTransaction(apply, {
                readConcern: { level: "snapshot" },
                writeConcern: { w: "majority" },
            });
            return (0, result_1.ok)(undefined);
        }
        catch (error) {
            return (0, result_1.err)(error instanceof Error
                ? error
                : new Error("Failed to consume ingredients atomically"));
        }
        finally {
            await session.endSession();
        }
    }
}
exports.MongoDBIngredientRepository = MongoDBIngredientRepository;
//# sourceMappingURL=mongodb-ingredient-repository.js.map