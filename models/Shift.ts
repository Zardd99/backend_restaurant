import mongoose, { Document, Schema, Types } from "mongoose";

export interface IZReport {
  shiftId: string;
  openedAt: Date;
  closedAt: Date;
  startingFloat: number;
  cashSales: number;
  cashTips: number;
  cardSales: number;
  khqrSales: number;
  expectedCash: number;
  actualCashCounted: number;
  discrepancy: number;
  orderCount: number;
}

export interface IShift extends Document {
  openedBy: Types.ObjectId;
  closedBy?: Types.ObjectId;
  openedAt: Date;
  closedAt?: Date;
  startingFloat: number;
  expectedCash?: number;
  actualCashCounted?: number;
  discrepancy?: number;
  status: "open" | "closed";
  zReport?: IZReport;
  createdAt: Date;
  updatedAt: Date;
}

const shiftSchema: Schema = new Schema(
  {
    openedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    closedBy: { type: Schema.Types.ObjectId, ref: "User" },
    openedAt: { type: Date, default: Date.now, index: true },
    closedAt: { type: Date },
    startingFloat: { type: Number, required: true, min: 0 },
    expectedCash: { type: Number },
    actualCashCounted: { type: Number },
    discrepancy: { type: Number },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
      index: true,
    },
    zReport: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

// At most one open shift (drawer) at a time across the whole restaurant.
shiftSchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: "open" } },
);

export default mongoose.model<IShift>("Shift", shiftSchema);
