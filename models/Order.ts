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
  // customer: Types.ObjectId;
  customerName?: string;
  tableNumber?: number;
  orderType: "dine-in" | "takeaway" | "delivery";
  orderDate: Date;
  inventoryDeduction?: InventoryDeduction;
  // Timeout fields
  totalPrepTimeoutMinutes?: number; // Total timeout for prep (in minutes)
  prepStartedAt?: Date; // When preparation started
  prepTimeoutAt?: Date; // When preparation will timeout
  lastPrepUpdateAt?: Date; // Last update from chef
  autoCancel?: boolean; // Auto-cancel on timeout
  cancelledReason?: string; // Reason for cancellation
  paymentStatus: "unpaid" | "paid";
  paymentMethod?: "cash" | "credit_card" | "debit_card" | "KHQR" | null;
  paidAt?: Date;
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

// Customer (customerName: string) here is not a User it only a string which is the name of the customer, no ref to User model.
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
      index: true,
    },
    // customer: { type: Schema.Types.ObjectId, ref: "User" },
    customerName: { type: String },
    tableNumber: { type: Number, min: 1, index: true },
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
    // Timeout fields
    totalPrepTimeoutMinutes: {
      type: Number,
      default: 30,
      min: 1,
    },
    prepStartedAt: { type: Date, index: true },
    prepTimeoutAt: { type: Date, index: true },
    lastPrepUpdateAt: { type: Date },
    autoCancel: { type: Boolean, default: true },
    cancelledReason: { type: String },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid",
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "credit_card", "debit_card", "KHQR"],
      default: null,
    },
    paidAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

// Partial unique index: only one active order per table at a time.
// Key is tableNumber alone (not compound with status) so that a table with a
// "pending" order cannot also receive a "confirmed" order — two documents with
// different statuses but the same tableNumber would otherwise produce distinct
// compound keys and bypass uniqueness enforcement.
// NOTE: The old compound index (tableNumber_1_status_1) must be dropped manually
// from MongoDB before deploying, e.g.:
//   db.orders.dropIndex("tableNumber_1_status_1")
orderSchema.index(
  { tableNumber: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      tableNumber: { $exists: true, $ne: null },
      status: { $in: ["pending", "confirmed", "preparing", "ready"] },
    },
  },
);

export default mongoose.model<IOrderDocument>("Order", orderSchema);
