import mongoose, { Document, Schema, Types } from "mongoose";

export interface IOrderItem {
  menuItem: Types.ObjectId;
  quantity: number;
  specialInstructions?: string;
  price: number;
}

export interface IOrder extends Document {
  items: IOrderItem[];
  totalAmount: number;
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
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema: Schema = new Schema({
  menuItem: { type: Schema.Types.ObjectId, ref: "MenuItem", required: true },
  quantity: { type: Number, required: true, min: 1 },
  specialInstructions: { type: String, maxlength: 200 },
  price: { type: Number, required: true },
});

const orderSchema: Schema = new Schema(
  {
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true },
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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IOrder>("Order", orderSchema);
