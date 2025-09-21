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
  }[];
  dietaryTags: string[];
  availability: boolean;
  preparationTime: number;
  chefSpecial: boolean;
  averageRating: number;
  reviewCount: number;
}

const menuItemSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    image: { type: String, default: "" },
    ingredientReferences: [
      {
        ingredient: {
          type: Schema.Types.ObjectId,
          ref: "Ingredient", // Reference to an Ingredient model
          required: true,
        },
        quantity: { type: Number, required: true, min: 0 },
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
  },
  {
    timestamps: true,
  }
);

menuItemSchema.index({ name: "text", description: "text" });
menuItemSchema.index({ category: 1, availability: 1 });

export default mongoose.model<IMenuItem>("MenuItem", menuItemSchema);
