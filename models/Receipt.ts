import mongoose, { Document, Schema, Types } from "mongoose";

export interface IReceipt extends Document {
  order: Types.ObjectId;
  receiptNumber: string;
  paymentMethod: "cash" | "credit_card" | "debit_card" | "KHQR";
  paymentStatus: "pending" | "completed" | "failed" | "refunded";
  subtotal: number;
  tax: number;
  discount?: number;
  totalAmount: number; 
  issuedAt: Date;
  customer: Types.ObjectId;
  items: {
    menuItem: Types.ObjectId;
    name: string;
    quantity: number;
    price: number;
  }[];
}

const receiptSchema: Schema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    receiptNumber: { type: String, required: true, unique: true },
    paymentMethod: {
      type: String,
      enum: ["cash", "credit_card", "debit_card", "KHQR"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    issuedAt: { type: Date, default: Date.now },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: [
      {
        menuItem: { type: Schema.Types.ObjectId, ref: "MenuItem" },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IReceipt>("Receipt", receiptSchema);
