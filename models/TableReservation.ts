import mongoose, { Document, Schema, Types } from "mongoose";

export const RESERVATION_STATUSES = [
  "pending",
  "seated",
  "cancelled",
  "no_show",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export interface ITableReservation extends Document {
  guestName: string;
  partySize: number;
  reservedFor: Date;
  durationMinutes: number;
  tableId: Types.ObjectId | null;
  status: ReservationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const tableReservationSchema: Schema = new Schema(
  {
    guestName: { type: String, required: true, trim: true },
    partySize: { type: Number, required: true, min: 1 },
    reservedFor: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, default: 120, min: 1 },
    tableId: {
      type: Schema.Types.ObjectId,
      ref: "Table",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: RESERVATION_STATUSES,
      default: "pending",
      index: true,
    },
  },
  { timestamps: true },
);

// The allocation guard queries "pending reservations starting within the lookahead
// window for these tables" — index the fields that filter drives.
tableReservationSchema.index({ tableId: 1, status: 1, reservedFor: 1 });

export default mongoose.model<ITableReservation>(
  "TableReservation",
  tableReservationSchema,
);
