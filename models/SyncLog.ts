import mongoose, { Document, Schema } from "mongoose";

export type SyncEntity = "table" | "order";
export type SyncResolution = "client_applied" | "server_kept" | "merged";

/**
 * One conflict that the deterministic reconciler resolved while ingesting a
 * device's offline queue. Captures both clock readings and the chosen outcome
 * so a contested write can always be explained after the fact.
 */
export interface IResolvedConflict {
  entity: SyncEntity;
  targetId: string;
  clientTimestamp: Date;
  serverTimestamp: Date;
  resolution: SyncResolution;
  mergedFields: string[];
}

export interface ISyncLog extends Document {
  deviceId: string;
  syncTimestamp: Date;
  appliedCount: number;
  conflictsResolved: IResolvedConflict[];
  createdAt: Date;
  updatedAt: Date;
}

const resolvedConflictSchema: Schema = new Schema(
  {
    entity: { type: String, enum: ["table", "order"], required: true },
    targetId: { type: String, required: true },
    clientTimestamp: { type: Date, required: true },
    serverTimestamp: { type: Date, required: true },
    resolution: {
      type: String,
      enum: ["client_applied", "server_kept", "merged"],
      required: true,
    },
    mergedFields: { type: [String], default: [] },
  },
  { _id: false },
);

const syncLogSchema: Schema = new Schema(
  {
    deviceId: { type: String, required: true, trim: true, index: true },
    syncTimestamp: { type: Date, default: Date.now, index: true },
    appliedCount: { type: Number, default: 0, min: 0 },
    conflictsResolved: { type: [resolvedConflictSchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model<ISyncLog>("SyncLog", syncLogSchema);
