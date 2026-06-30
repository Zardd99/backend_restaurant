import mongoose, { Document, Schema } from "mongoose";

export type NotificationType =
  | "order_created"
  | "order_preparing"
  | "order_ready"
  | "order_served"
  | "birthday_today";

export interface INotification extends Document {
  type: NotificationType;
  orderId?: string;
  tableNumber?: number;
  customerName?: string;
  itemCount: number;
  actor?: { id: string; name: string; role: string };
  title?: string;
  message?: string;
  timestamp: Date;
  read: boolean;
}

const NotificationSchema = new Schema<INotification>(
  {
    type: {
      type: String,
      enum: [
        "order_created",
        "order_preparing",
        "order_ready",
        "order_served",
        "birthday_today",
      ],
      required: true,
    },
    // Order-specific fields — required only for the order_* notification types.
    orderId: {
      type: String,
      required: function (this: INotification) {
        return this.type !== "birthday_today";
      },
    },
    tableNumber:   { type: Number },
    customerName:  { type: String },
    itemCount:     { type: Number, required: true, default: 0 },
    actor: {
      id:   { type: String },
      name: { type: String },
      role: { type: String },
    },
    // Generic display fields — used by non-order notifications (e.g. birthdays).
    title:   { type: String },
    message: { type: String },
    timestamp: { type: Date, required: true, default: Date.now },
    read:      { type: Boolean, required: true, default: false },
  },
  { timestamps: false },
);

NotificationSchema.index({ timestamp: -1 });

export default mongoose.model<INotification>("Notification", NotificationSchema);
