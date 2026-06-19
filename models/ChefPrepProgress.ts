import mongoose, { Document, Schema, Types } from "mongoose";

export interface IPrepStep {
  stepName: string;
  description?: string;
  estimatedDurationMinutes: number;
  status: "pending" | "in-progress" | "completed" | "skipped" | "failed";
  startedAt?: Date;
  completedAt?: Date;
  timeoutAt?: Date;
  notes?: string;
}

export interface IChefPrepProgress extends Document {
  orderId: Types.ObjectId;
  chefId?: Types.ObjectId;
  chefName?: string;
  steps: IPrepStep[];
  overallStatus: "pending" | "in-progress" | "completed" | "cancelled";
  totalEstimatedMinutes: number;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const prepStepSchema: Schema = new Schema({
  stepName: {
    type: String,
    required: true,
    enum: ["ingredient_prep", "cooking", "plating", "quality_check", "custom"],
  },
  description: { type: String },
  estimatedDurationMinutes: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ["pending", "in-progress", "completed", "skipped", "failed"],
    default: "pending",
  },
  startedAt: { type: Date },
  completedAt: { type: Date },
  timeoutAt: { type: Date },
  notes: { type: String },
});

const chefPrepProgressSchema: Schema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    chefId: { type: Schema.Types.ObjectId, ref: "User" },
    chefName: { type: String },
    steps: [prepStepSchema],
    overallStatus: {
      type: String,
      enum: ["pending", "in-progress", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    totalEstimatedMinutes: { type: Number, required: true, min: 1 },
    startedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String },
  },
  {
    timestamps: true,
  },
);

// Index for efficient querying
chefPrepProgressSchema.index({ orderId: 1, overallStatus: 1 });
chefPrepProgressSchema.index({ createdAt: 1 });

export default mongoose.model<IChefPrepProgress>(
  "ChefPrepProgress",
  chefPrepProgressSchema,
);
