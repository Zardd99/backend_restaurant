import mongoose, { Document, Schema, Types } from "mongoose";

export interface IPromotion extends Document {
  name: string;
  description?: string;
  discountType: "percentage" | "fixed";
  discountValue: number; // e.g., 10 for 10% or $5 for fixed
  appliesTo: "all" | "category" | "menuItem";
  targetIds: Types.ObjectId[]; // categories or menu items
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdBy: Types.ObjectId;
  minimumOrderAmount?: number;
  maxUsagePerCustomer?: number;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const promotionSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
      validate: [
        {
          validator: function (this: any) {
            if (
              this.discountType === "percentage" &&
              this.discountValue > 100
            ) {
              return false;
            }
            return true;
          },
          message: "Percentage discount must be between 0 and 100",
        },
      ],
    },
    appliesTo: {
      type: String,
      enum: ["all", "category", "menuItem"],
      required: true,
    },
    targetIds: [
      {
        type: Schema.Types.ObjectId,
        refPath: "appliesTo", // This will reference either Category or MenuItem
      },
    ],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    minimumOrderAmount: { type: Number, default: 0 },
    maxUsagePerCustomer: { type: Number, default: null },
    usageCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  },
);

// Index for efficient querying of active promotions within a date range
promotionSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

export default mongoose.model<IPromotion>("Promotion", promotionSchema);
