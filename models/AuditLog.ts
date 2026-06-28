import mongoose, { Document, Schema, Types } from "mongoose";

export type AuditAction =
  | "VOID_ORDER"
  | "VOID_ITEM"
  | "COMP_ORDER"
  | "APPLY_DISCOUNT"
  | "MODIFY_ORDER"
  | "TRANSFER_TABLE"
  | "MERGE_TABLES"
  | "PROCESS_PAYMENT"
  | "REFUND"
  | "TOGGLE_86"
  | "OPEN_SHIFT"
  | "CLOSE_SHIFT"
  | "AUTO_ASSIGN_TABLE"
  | "SEAT_GUESTS"
  | "CHECKOUT_TABLE"
  | "BUS_TABLE"
  | "JOIN_TABLES"
  | "SPLIT_TABLES";

export type AuditTargetType =
  | "Order"
  | "OrderItem"
  | "MenuItem"
  | "Table"
  | "TableReservation"
  | "Shift";

export interface IAuditLog extends Document {
  timestamp: Date;
  userId: Types.ObjectId;
  userRole: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: Types.ObjectId;
  reason?: string;
  diff?: { before: unknown; after: unknown };
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema: Schema = new Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userRole: { type: String, required: true },
    action: {
      type: String,
      enum: [
        "VOID_ORDER",
        "VOID_ITEM",
        "COMP_ORDER",
        "APPLY_DISCOUNT",
        "MODIFY_ORDER",
        "TRANSFER_TABLE",
        "MERGE_TABLES",
        "PROCESS_PAYMENT",
        "REFUND",
        "TOGGLE_86",
        "OPEN_SHIFT",
        "CLOSE_SHIFT",
        "AUTO_ASSIGN_TABLE",
        "SEAT_GUESTS",
        "CHECKOUT_TABLE",
        "BUS_TABLE",
        "JOIN_TABLES",
        "SPLIT_TABLES",
      ],
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: [
        "Order",
        "OrderItem",
        "MenuItem",
        "Table",
        "TableReservation",
        "Shift",
      ],
      required: true,
    },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    reason: { type: String, maxlength: 500 },
    diff: {
      before: Schema.Types.Mixed,
      after: Schema.Types.Mixed,
    },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);

// Immutability: audit entries are append-only. Reject any update/delete query
// at the model layer so the trail cannot be tampered with through Mongoose.
auditLogSchema.pre(
  /^(updateOne|updateMany|findOneAndUpdate|deleteOne|deleteMany|findOneAndDelete)$/,
  function (next: (err?: Error) => void) {
    next(
      new Error("Audit logs are immutable and cannot be modified or deleted"),
    );
  },
);

export default mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
