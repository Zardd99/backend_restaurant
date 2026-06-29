import mongoose, { Document, Schema } from "mongoose";

export type InventoryAuditStatus = "draft" | "submitted";

/**
 * One counted line of a physical stocktake.
 *
 * `variance` = actual − theoretical (negative = shrinkage). `varianceCost` is
 * the monetary impact valued against FIFO batch unit costs at submission time.
 */
export interface IInventoryAuditItem {
  ingredientId: string;
  theoreticalStock: number;
  actualStock: number;
  variance: number;
  varianceCost: number;
}

export interface IInventoryAudit extends Document {
  auditDate: Date;
  auditedBy: string;
  status: InventoryAuditStatus;
  items: IInventoryAuditItem[];
  createdAt: Date;
  updatedAt: Date;
}

const inventoryAuditItemSchema: Schema = new Schema(
  {
    ingredientId: { type: String, required: true, trim: true },
    theoreticalStock: { type: Number, required: true },
    actualStock: { type: Number, required: true, min: 0 },
    variance: { type: Number, required: true },
    varianceCost: { type: Number, required: true },
  },
  { _id: false },
);

const inventoryAuditSchema: Schema = new Schema(
  {
    auditDate: { type: Date, default: Date.now, index: true },
    auditedBy: { type: String, required: true },
    status: {
      type: String,
      enum: ["draft", "submitted"],
      default: "draft",
      index: true,
    },
    items: { type: [inventoryAuditItemSchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model<IInventoryAudit>(
  "InventoryAudit",
  inventoryAuditSchema,
);
