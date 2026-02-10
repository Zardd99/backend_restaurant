import mongoose, { Document, Schema, Types } from "mongoose";

export interface IOrderItem {
  menuItem: Types.ObjectId;
  quantity: number;
  specialInstructions?: string;
  price: number;
  // Promotion fields (optional for backward compatibility)
  originalPrice?: number; // Price before discount
  discountAmount?: number; // Total discount on this item (quantity independent)
  finalPrice?: number; // Price after discount (per unit)
  appliedPromotion?: Types.ObjectId; // Reference to Promotion document
}

export interface InventoryDeduction {
  status: "pending" | "completed" | "failed" | "skipped";
  data?: any;
  warning?: string;
  timestamp?: Date;
  lastUpdated?: Date;
}

export interface IOrder extends Document {
  items: IOrderItem[];
  totalAmount: number;
  totalDiscountAmount?: number; // Total discount applied to entire order
  status:
    | "pending"
    | "confirmed"
    | "preparing"
    | "ready"
    | "served"
    | "cancelled";
  customer: Types.ObjectId;
  tableNumber?: number;
  orderType: "dine-in" | "takeaway" | "delivery";
  orderDate: Date;
  inventoryDeduction?: InventoryDeduction;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrderDocument extends IOrder, Document {}

const orderItemSchema: Schema = new Schema({
  menuItem: { type: Schema.Types.ObjectId, ref: "MenuItem", required: true },
  quantity: { type: Number, required: true, min: 1 },
  specialInstructions: { type: String, maxlength: 200 },
  price: { type: Number, required: true }, // Keep for backward compatibility
  // New promotion fields (optional)
  originalPrice: { type: Number }, // Original price before discount
  discountAmount: { type: Number, default: 0 }, // Discount per unit
  finalPrice: { type: Number }, // Effective price per unit after discount
  appliedPromotion: { type: Schema.Types.ObjectId, ref: "Promotion" }, // Applied promotion ID
});

const orderSchema: Schema = new Schema(
  {
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true },
    totalDiscountAmount: { type: Number, default: 0 }, // New: total discount on order
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "served",
        "cancelled",
      ],
      default: "pending",
    },
    customer: { type: Schema.Types.ObjectId, ref: "User" },
    tableNumber: { type: Number, min: 1 },
    orderType: {
      type: String,
      enum: ["dine-in", "takeaway", "delivery"],
      required: true,
    },
    orderDate: { type: Date, default: Date.now },
    inventoryDeduction: {
      status: {
        type: String,
        enum: ["pending", "completed", "failed", "skipped"],
        default: "pending",
      },
      data: mongoose.Schema.Types.Mixed,
      warning: String,
      timestamp: Date,
      lastUpdated: Date,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model<IOrderDocument>("Order", orderSchema);
