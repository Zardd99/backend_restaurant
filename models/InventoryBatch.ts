import mongoose, { Document, Schema } from "mongoose";

/**
 * A discrete delivery of a raw ingredient at a known unit cost.
 *
 * FIFO costing consumes the oldest non-expired batch first, so `unitCost` is
 * frozen at receipt time and `remainingQuantity` is drawn down as the batch is
 * used or wasted. The compound index covers the FIFO allocation scan
 * (oldest-first among the non-expired, still-stocked batches of one ingredient).
 */
export interface IInventoryBatch extends Document {
  ingredientId: string;
  initialQuantity: number;
  remainingQuantity: number;
  unitCost: number;
  expiryDate: Date;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const inventoryBatchSchema: Schema = new Schema(
  {
    ingredientId: { type: String, required: true, trim: true, index: true },
    initialQuantity: { type: Number, required: true, min: 0 },
    remainingQuantity: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    expiryDate: { type: Date, required: true },
    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

inventoryBatchSchema.index({
  ingredientId: 1,
  expiryDate: 1,
  receivedAt: 1,
  remainingQuantity: 1,
});

export default mongoose.model<IInventoryBatch>(
  "InventoryBatch",
  inventoryBatchSchema,
);
