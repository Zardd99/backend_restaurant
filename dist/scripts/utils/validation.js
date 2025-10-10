"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateMenuItems = validateMenuItems;
exports.checkForDuplicates = checkForDuplicates;
const mongoose_1 = __importDefault(require("mongoose"));
function validateMenuItems(data) {
    if (!Array.isArray(data)) {
        throw new Error("Data must be an array");
    }
    data.forEach((item, index) => {
        if (!item.name || typeof item.name !== "string") {
            throw new Error(`Item at index ${index} is missing a valid name`);
        }
        if (!item.description || typeof item.description !== "string") {
            throw new Error(`Item at index ${index} is missing a valid description`);
        }
        if (typeof item.price !== "number" || item.price <= 0) {
            throw new Error(`Item at index ${index} must have a valid price`);
        }
        if (!item.category || !mongoose_1.default.Types.ObjectId.isValid(item.category)) {
            throw new Error(`Item at index ${index} must have a valid category ID`);
        }
        if (!Array.isArray(item.ingredientReferences)) {
            throw new Error(`Item at index ${index} must have an array of ingredients`);
        }
        if (!Array.isArray(item.dietaryTags)) {
            throw new Error(`Item at index ${index} must have an array of dietary tags`);
        }
        if (typeof item.availability !== "boolean") {
            throw new Error(`Item at index ${index} must have a valid isAvailable boolean`);
        }
        if (typeof item.preparationTime !== "number" || item.preparationTime <= 0) {
            throw new Error(`Item at index ${index} must have a valid preparation time`);
        }
    });
}
async function checkForDuplicates(data, model, field = "name") {
    const values = data.map((item) => item[field]);
    const existingItems = await model.find({
        [field]: { $in: values },
    });
    const existingValues = new Set(existingItems.map((item) => item.toObject()[field]));
    const newItems = data.filter((item) => !existingValues.has(item[field]));
    const duplicates = data.filter((item) => existingValues.has(item[field]));
    return { newItems, duplicates };
}
//# sourceMappingURL=validation.js.map