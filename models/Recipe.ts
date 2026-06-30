import mongoose, { Document, Schema, Types } from "mongoose";

export type RecipeTargetType = "MenuItem" | "Ingredient";

/**
 * One component line of a bill of materials.
 *
 * `grossQuantity` is the raw amount drawn from stock; `netQuantity` is what
 * survives prep onto the plate. `yieldFactor` (net / gross) is derived and kept
 * denormalised for fast costing/forecasting reads.
 */
export interface IRecipeComponent {
  ingredientId: string;
  grossQuantity: number;
  netQuantity: number;
  yieldFactor: number;
  unit: string;
}

export interface IRecipe extends Document {
  targetId: Types.ObjectId;
  targetType: RecipeTargetType;
  ingredients: IRecipeComponent[];
  createdAt: Date;
  updatedAt: Date;
}

const recipeComponentSchema: Schema = new Schema(
  {
    ingredientId: { type: String, required: true, trim: true },
    grossQuantity: { type: Number, required: true, min: 0 },
    netQuantity: { type: Number, required: true, min: 0 },
    yieldFactor: { type: Number, required: true, min: 0, max: 1 },
    unit: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const recipeSchema: Schema = new Schema(
  {
    // Polymorphic target: a sellable MenuItem or an in-house prepped Ingredient.
    targetId: { type: Schema.Types.ObjectId, required: true },
    targetType: {
      type: String,
      enum: ["MenuItem", "Ingredient"],
      required: true,
    },
    ingredients: { type: [recipeComponentSchema], default: [] },
  },
  { timestamps: true },
);

// One recipe per target (a MenuItem or prepped Ingredient has a single BOM).
recipeSchema.index({ targetId: 1, targetType: 1 }, { unique: true });

// Keep the derived yield factor consistent on every write.
recipeSchema.pre("validate", async function () {
  const recipe = this as unknown as IRecipe;
  for (const component of recipe.ingredients ?? []) {
    component.yieldFactor =
      component.grossQuantity > 0
        ? component.netQuantity / component.grossQuantity
        : 0;
  }
});

export default mongoose.model<IRecipe>("Recipe", recipeSchema);
