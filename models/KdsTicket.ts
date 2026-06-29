import mongoose, { Document, Schema, Types } from "mongoose";

export type KdsStation = "grill" | "fry" | "prep" | "expo" | "pantry";
export type PacingStatus = "hold" | "fired" | "completed";
export type KdsTicketStatus = "pending" | "active" | "completed" | "expedited";

export const KDS_STATIONS: KdsStation[] = [
  "grill",
  "fry",
  "prep",
  "expo",
  "pantry",
];

export interface IKdsStationItem {
  itemId: Types.ObjectId;
  name: string;
  station: KdsStation;
  cookTimeMinutes: number;
  pacingStatus: PacingStatus;
  targetFireTime: Date;
  expoAlertSent: boolean;
}

export interface IKdsTicket extends Document {
  orderId: Types.ObjectId;
  ticketStatus: KdsTicketStatus;
  stationItems: IKdsStationItem[];
  createdAt: Date;
  updatedAt: Date;
}

const kdsStationItemSchema: Schema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true },
    station: {
      type: String,
      enum: KDS_STATIONS,
      required: true,
    },
    cookTimeMinutes: { type: Number, required: true, min: 0 },
    pacingStatus: {
      type: String,
      enum: ["hold", "fired", "completed"],
      default: "hold",
    },
    targetFireTime: { type: Date, required: true },
    expoAlertSent: { type: Boolean, default: false },
  },
  { _id: false },
);

const kdsTicketSchema: Schema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },
    ticketStatus: {
      type: String,
      enum: ["pending", "active", "completed", "expedited"],
      default: "pending",
      index: true,
    },
    stationItems: { type: [kdsStationItemSchema], default: [] },
  },
  { timestamps: true },
);

// The recurring pacing job scans for held items whose fire time has elapsed.
// This partial-style compound index keeps that scan covered and fast.
kdsTicketSchema.index({
  "stationItems.pacingStatus": 1,
  "stationItems.targetFireTime": 1,
});

export default mongoose.model<IKdsTicket>("KdsTicket", kdsTicketSchema);
