import mongoose, { Document, Schema, Types } from "mongoose";

export const TABLE_SECTIONS = ["indoor", "patio", "bar", "vip"] as const;
export type TableSection = (typeof TABLE_SECTIONS)[number];

export const TABLE_STATUSES = [
  "vacant",
  "occupied",
  "reserved",
  "dirty",
] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

export interface ITable extends Document {
  tableNumber: string;
  capacity: number;
  section: TableSection;
  status: TableStatus;
  currentOrderId: Types.ObjectId | null;
  currentGuestCount: number;
  joinedWith: string[];
  reservationTime: Date | null;
  // Set whenever the table becomes vacant; drives FIFO wear-leveling so the
  // longest-idle table is reused first when several are equivalent.
  vacantSince: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const tableSchema: Schema = new Schema(
  {
    tableNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    capacity: { type: Number, required: true, min: 1 },
    section: {
      type: String,
      enum: TABLE_SECTIONS,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: TABLE_STATUSES,
      default: "vacant",
      index: true,
    },
    currentOrderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    currentGuestCount: { type: Number, default: 0, min: 0 },
    joinedWith: { type: [String], default: [] },
    reservationTime: { type: Date, default: null },
    vacantSince: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Auto-allocation scans by (section, status, capacity) and orders idle tables by
// vacantSince — this compound index keeps that hot path index-covered.
tableSchema.index({ section: 1, status: 1, capacity: 1, vacantSince: 1 });

export default mongoose.model<ITable>("Table", tableSchema);
