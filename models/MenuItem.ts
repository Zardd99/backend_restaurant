import mongoose, { Document, Schema, Types } from "mongoose";

export interface IMenuItem extends Document {
  name: string;
  description: string;
  price: number;
  category: Types.ObjectId;
  image: string;
  ingredientReferences: {
    ingredient: Types.ObjectId;
    quantity: number;
    unit: string;
  }[];
  dietaryTags: string[];
  availability: boolean;
  preparationTime: number;
  chefSpecial: boolean;
  averageRating: number;
  reviewCount: number;
  costPrice?: number;
  profitMargin?: number;
}

const menuItemSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: Schema.Types.ObjectId, ref: "Category" },
    image: { type: String, default: "" },
    ingredientReferences: [
      {
        ingredient: {
          type: Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
  },
);

// Middleware to calculate cost price before saving
menuItemSchema.pre("save", async function (next) {
  try {
    const menuItem = this as unknown as IMenuItem;

    if (
      menuItem.ingredientReferences &&
      menuItem.ingredientReferences.length > 0
    ) {
      const IngredientModel = mongoose.model("Ingredient");
      let totalCost = 0;

      for (const ref of menuItem.ingredientReferences) {
        const ingredient = await IngredientModel.findById(ref.ingredient);
        if (ingredient && "costPerUnit" in ingredient) {
          const cost = (ingredient.costPerUnit as number) * ref.quantity;
          totalCost += cost;
        }
      }

      menuItem.costPrice = parseFloat(totalCost.toFixed(2));
      if (menuItem.price > 0) {
        menuItem.profitMargin = parseFloat(
          (
            ((menuItem.price - menuItem.costPrice) / menuItem.price) *
            100
          ).toFixed(2),
        );
      }
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

menuItemSchema.index({ name: "text", description: "text" });
menuItemSchema.index({ category: 1, availability: 1 });
menuItemSchema.index({ "ingredientReferences.ingredient": 1 });

export default mongoose.model<IMenuItem>("MenuItem", menuItemSchema);
