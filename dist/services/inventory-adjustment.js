"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyInventoryDelta = applyInventoryDelta;
const MenuItem_1 = __importDefault(require("../models/MenuItem"));
const Supplier_1 = require("../models/Supplier");
async function applyInventoryDelta(lines, sign, session) {
    var _a, _b;
    const menuItemIds = lines.map((line) => String(line.menuItem));
    const menuItems = await MenuItem_1.default.find({ _id: { $in: menuItemIds } })
        .session(session)
        .lean();
    const recipeByMenuItem = new Map(menuItems.map((mi) => {
        var _a;
        return [
            String(mi._id),
            ((_a = mi.ingredientReferences) !== null && _a !== void 0 ? _a : []),
        ];
    }));
    const deltaByIngredient = new Map();
    for (const line of lines) {
        const refs = (_a = recipeByMenuItem.get(String(line.menuItem))) !== null && _a !== void 0 ? _a : [];
        for (const ref of refs) {
            const id = String(ref.ingredient);
            deltaByIngredient.set(id, ((_b = deltaByIngredient.get(id)) !== null && _b !== void 0 ? _b : 0) + ref.quantity * line.quantity * sign);
        }
    }
    for (const [ingredientId, delta] of deltaByIngredient) {
        if (delta === 0)
            continue;
        if (delta < 0) {
            const result = await Supplier_1.Ingredient.updateOne({ _id: ingredientId, currentStock: { $gte: -delta } }, { $inc: { currentStock: delta } }, { session });
            if (result.modifiedCount !== 1) {
                throw new Error(`INSUFFICIENT_STOCK:${ingredientId}`);
            }
        }
        else {
            await Supplier_1.Ingredient.updateOne({ _id: ingredientId }, { $inc: { currentStock: delta } }, { session });
        }
    }
}
//# sourceMappingURL=inventory-adjustment.js.map