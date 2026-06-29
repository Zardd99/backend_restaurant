import mongoose, { Document, Schema } from "mongoose";

export type WasteReason = "spoilage" | "dropped" | "comp" | "kitchen_error";

export const WASTE_REASONS: WasteReason[] = [
  "spoilage",
  "dropped",
  "comp",
  "kitchen_error",
];

/**
 * Per-batch breakdown of how a single waste event was costed. Because FIFO can
 * span several batches at different unit costs, the breakdown preserves the
 * exact provenance of `costLost` for later audit.
 */
export interface IWasteBatchConsumption {
  batchId: mongoose.Types.ObjectId;
  quantity: number;
  unitCost: number;
}

export interface IWasteLog extends Document {
  ingredientId: string;
  quantity: number;
  unit: string;
  costLost: number;
  reason: WasteReason;
  loggedBy: string;
  batchBreakdown: IWasteBatchConsumption[];
  createdAt: Date;
  updatedAt: Date;
}

const wasteBatchConsumptionSchema: Schema = new Schema(
  {
    batchId: { type: Schema.Types.ObjectId, ref: "InventoryBatch", required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const wasteLogSchema: Schema = new Schema(
  {
    ingredientId: { type: String, required: true, trim: true, index: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true },
    costLost: { type: Number, required: true, min: 0 },
    reason: {
      type: String,
      enum: WASTE_REASONS,
      required: true,
      index: true,
    },
    loggedBy: { type: String, required: true },
    batchBreakdown: { type: [wasteBatchConsumptionSchema], default: [] },
  },
  { timestamps: true },
);

// Immutable ledger: waste entries are append-only. Reject any update/delete
// query at the model layer so the discarded-cost trail cannot be rewritten.
wasteLogSchema.pre(
  /^(updateOne|updateMany|findOneAndUpdate|deleteOne|deleteMany|findOneAndDelete)$/,
  function (next: (err?: Error) => void) {
    next(new Error("Waste logs are immutable and cannot be modified or deleted"));
  },
);

export default mongoose.model<IWasteLog>("WasteLog", wasteLogSchema);
