import mongoose, { Document, Schema } from "mongoose";

export type NotificationType =
  | "order_created"
  | "order_preparing"
  | "order_ready"
  | "order_served";

export interface INotification extends Document {
  type: NotificationType;
  orderId: string;
  tableNumber?: number;
  customerName?: string;
  itemCount: number;
  actor: { id: string; name: string; role: string };
  timestamp: Date;
  read: boolean;
}

const NotificationSchema = new Schema<INotification>(
  {
    type: {
      type: String,
      enum: ["order_created", "order_preparing", "order_ready", "order_served"],
      required: true,
    },
    orderId:       { type: String, required: true },
    tableNumber:   { type: Number },
    customerName:  { type: String },
    itemCount:     { type: Number, required: true, default: 0 },
    actor: {
      id:   { type: String, required: true },
      name: { type: String, required: true },
      role: { type: String, required: true },
    },
    timestamp: { type: Date, required: true, default: Date.now },
    read:      { type: Boolean, required: true, default: false },
  },
  { timestamps: false },
);

NotificationSchema.index({ timestamp: -1 });

export default mongoose.model<INotification>("Notification", NotificationSchema);
