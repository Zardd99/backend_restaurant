"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const menuItemSchema = new mongoose_1.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: mongoose_1.Schema.Types.ObjectId, ref: "Category" },
    image: { type: String, default: "" },
    ingredientReferences: [
        {
            ingredient: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: "Ingredient",
                required: true,
            },
            quantity: { type: Number, required: true, min: 0 },
            unit: { type: String, required: true },
        },
    ],
    dietaryTags: [
        {
            type: String,
            enum: [
                "vegetarian",
                "vegan",
                "gluten-free",
                "dairy-free",
                "spicy",
                "nut-free",
            ],
        },
    ],
    availability: { type: Boolean, default: true },
    preparationTime: { type: Number, default: 15 },
    chefSpecial: { type: Boolean, default: false },
    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    costPrice: { type: Number },
    profitMargin: { type: Number },
}, {
    timestamps: true,
});
menuItemSchema.pre("save", async function () {
    try {
        const menuItem = this;
        if (menuItem.ingredientReferences &&
            menuItem.ingredientReferences.length > 0) {
            const IngredientModel = mongoose_1.default.model("Ingredient");
            let totalCost = 0;
            for (const ref of menuItem.ingredientReferences) {
                const ingredient = await IngredientModel.findById(ref.ingredient);
                if (ingredient && "costPerUnit" in ingredient) {
                    const cost = ingredient.costPerUnit * ref.quantity;
                    totalCost += cost;
                }
            }
            menuItem.costPrice = parseFloat(totalCost.toFixed(2));
            if (menuItem.price > 0) {
                menuItem.profitMargin = parseFloat((((menuItem.price - menuItem.costPrice) / menuItem.price) *
                    100).toFixed(2));
            }
        }
    }
    catch (error) {
        throw error;
    }
});
menuItemSchema.index({ name: "text", description: "text" });
menuItemSchema.index({ category: 1, availability: 1 });
menuItemSchema.index({ "ingredientReferences.ingredient": 1 });
exports.default = mongoose_1.default.model("MenuItem", menuItemSchema);
//# sourceMappingURL=MenuItem.js.map