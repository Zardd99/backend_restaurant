import mongoose, { Types } from "mongoose";
import Table from "../models/Table";
import Order from "../models/Order";
import SyncLog, { ISyncLog, IResolvedConflict, SyncEntity } from "../models/SyncLog";

export interface QueuedTransaction {
  entity: SyncEntity;
  targetId: string;
  action: "update";
  clientTimestamp: string | number | Date;
  payload: Record<string, unknown>;
}

export interface SyncTransactionResult {
  targetId: string;
  entity: SyncEntity;
  status: "applied" | "merged" | "server_kept" | "rejected";
  message?: string;
}

export interface SyncOutcome {
  syncLogId: string;
  deviceId: string;
  appliedCount: number;
  conflicts: IResolvedConflict[];
  results: SyncTransactionResult[];
}

// Only these fields may be overwritten by an offline client. Anything else in a
// payload is ignored, closing off mass-assignment / operator-injection vectors.
const TABLE_WRITABLE_FIELDS = [
  "status",
  "currentGuestCount",
  "currentOrderId",
  "reservationTime",
] as const;

const ORDER_WRITABLE_FIELDS = ["status", "tableNumber"] as const;

const TABLE_STATUSES = ["vacant", "occupied", "reserved", "dirty"];
const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "served",
  "cancelled",
];

function toDate(value: unknown): Date {
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid clientTimestamp");
  }
  return date;
}

/**
 * Offline-first reconciler (CRDT-style sync endpoint).
 *
 * Devices replay the actions they queued while disconnected. Conflicts are
 * resolved deterministically by Last-Write-Wins on the modification clock:
 *  - server record newer than the client's action  → client overwrite aborted;
 *    scalar server values are kept, but order items the client added offline are
 *    merged in (union), and the collision is journaled to {@link SyncLog};
 *  - client action newer → applied atomically.
 *
 * Resolution depends only on persisted `updatedAt` values, so the endpoint is
 * correct regardless of which stateless instance handles a given device.
 */
export class ClientSyncService {
  async processOfflineSync(
    deviceId: string,
    queuedTransactions: QueuedTransaction[],
  ): Promise<SyncOutcome> {
    const safeDeviceId = String(deviceId).trim();
    if (!safeDeviceId) throw new Error("deviceId is required");
    if (!Array.isArray(queuedTransactions)) {
      throw new Error("queuedTransactions must be an array");
    }

    const conflicts: IResolvedConflict[] = [];
    const results: SyncTransactionResult[] = [];
    let appliedCount = 0;

    for (const tx of queuedTransactions) {
      try {
        const result = await this.reconcileOne(tx, conflicts);
        if (result.status === "applied" || result.status === "merged") {
          appliedCount += 1;
        }
        results.push(result);
      } catch (error) {
        results.push({
          targetId: String(tx?.targetId),
          entity: tx?.entity,
          status: "rejected",
          message: (error as Error).message,
        });
      }
    }

    const [syncLog] = await SyncLog.create([
      {
        deviceId: safeDeviceId,
        syncTimestamp: new Date(),
        appliedCount,
        conflictsResolved: conflicts,
      },
    ]);

    return {
      syncLogId: String((syncLog as ISyncLog)._id),
      deviceId: safeDeviceId,
      appliedCount,
      conflicts,
      results,
    };
  }

  private async reconcileOne(
    tx: QueuedTransaction,
    conflicts: IResolvedConflict[],
  ): Promise<SyncTransactionResult> {
    if (!tx || (tx.entity !== "table" && tx.entity !== "order")) {
      throw new Error("Unsupported sync entity");
    }
    if (!Types.ObjectId.isValid(String(tx.targetId))) {
      throw new Error("Invalid targetId");
    }
    const clientTimestamp = toDate(tx.clientTimestamp);

    return tx.entity === "table"
      ? this.reconcileTable(tx, clientTimestamp)
      : this.reconcileOrder(tx, clientTimestamp, conflicts);
  }

  private async reconcileTable(
    tx: QueuedTransaction,
    clientTimestamp: Date,
  ): Promise<SyncTransactionResult> {
    const session = await mongoose.startSession();
    try {
      let outcome: SyncTransactionResult = {
        targetId: tx.targetId,
        entity: "table",
        status: "server_kept",
      };

      await session.withTransaction(async () => {
        const table = await Table.findById(tx.targetId).session(session);
        if (!table) throw new Error("Table not found");

        // Client lost the race: server holds a newer write. LWW keeps the server.
        if (table.updatedAt.getTime() > clientTimestamp.getTime()) {
          outcome = { targetId: tx.targetId, entity: "table", status: "server_kept" };
          return;
        }

        const update = this.buildTableUpdate(tx.payload);
        if (Object.keys(update).length === 0) {
          outcome = {
            targetId: tx.targetId,
            entity: "table",
            status: "rejected",
            message: "No writable fields in payload",
          };
          return;
        }

        table.set(update);
        await table.save({ session });
        outcome = { targetId: tx.targetId, entity: "table", status: "applied" };
      });

      return outcome;
    } finally {
      await session.endSession();
    }
  }

  private buildTableUpdate(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const update: Record<string, unknown> = {};
    for (const field of TABLE_WRITABLE_FIELDS) {
      if (!(field in payload)) continue;
      const value = payload[field];

      if (field === "status") {
        const status = String(value);
        if (!TABLE_STATUSES.includes(status)) {
          throw new Error(`Invalid table status: ${status}`);
        }
        update.status = status;
      } else if (field === "currentGuestCount") {
        const count = Number(value);
        if (!Number.isFinite(count) || count < 0) {
          throw new Error("currentGuestCount must be a non-negative number");
        }
        update.currentGuestCount = count;
      } else if (field === "currentOrderId") {
        if (value === null) {
          update.currentOrderId = null;
        } else if (Types.ObjectId.isValid(String(value))) {
          update.currentOrderId = new Types.ObjectId(String(value));
        } else {
          throw new Error("Invalid currentOrderId");
        }
      } else if (field === "reservationTime") {
        update.reservationTime = value === null ? null : toDate(value);
      }
    }
    return update;
  }

  private async reconcileOrder(
    tx: QueuedTransaction,
    clientTimestamp: Date,
    conflicts: IResolvedConflict[],
  ): Promise<SyncTransactionResult> {
    const session = await mongoose.startSession();
    try {
      let outcome: SyncTransactionResult = {
        targetId: tx.targetId,
        entity: "order",
        status: "server_kept",
      };

      await session.withTransaction(async () => {
        const order = await Order.findById(tx.targetId).session(session);
        if (!order) throw new Error("Order not found");

        const serverTimestamp = order.updatedAt;

        if (serverTimestamp.getTime() > clientTimestamp.getTime()) {
          // LWW: server wins for scalar fields, but offline-added items are not
          // dropped — they are merged into the authoritative server order.
          const mergedFields = this.mergeAddedOrderItems(order, tx.payload);
          if (mergedFields.length > 0) {
            await order.save({ session });
            conflicts.push({
              entity: "order",
              targetId: tx.targetId,
              clientTimestamp,
              serverTimestamp,
              resolution: "merged",
              mergedFields,
            });
            outcome = { targetId: tx.targetId, entity: "order", status: "merged" };
          } else {
            conflicts.push({
              entity: "order",
              targetId: tx.targetId,
              clientTimestamp,
              serverTimestamp,
              resolution: "server_kept",
              mergedFields: [],
            });
            outcome = {
              targetId: tx.targetId,
              entity: "order",
              status: "server_kept",
            };
          }
          return;
        }

        const update = this.buildOrderUpdate(tx.payload);
        this.mergeAddedOrderItems(order, tx.payload);
        if (Object.keys(update).length > 0) order.set(update);
        await order.save({ session });
        outcome = { targetId: tx.targetId, entity: "order", status: "applied" };
      });

      return outcome;
    } finally {
      await session.endSession();
    }
  }

  private buildOrderUpdate(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const update: Record<string, unknown> = {};
    for (const field of ORDER_WRITABLE_FIELDS) {
      if (!(field in payload)) continue;
      const value = payload[field];

      if (field === "status") {
        const status = String(value);
        if (!ORDER_STATUSES.includes(status)) {
          throw new Error(`Invalid order status: ${status}`);
        }
        update.status = status;
      } else if (field === "tableNumber") {
        const tableNumber = Number(value);
        if (!Number.isFinite(tableNumber) || tableNumber < 1) {
          throw new Error("tableNumber must be a positive number");
        }
        update.tableNumber = tableNumber;
      }
    }
    return update;
  }

  /**
   * Append the items a client added while offline. An incoming item is treated
   * as a new addition when it carries no `_id` matching an existing server item,
   * so genuine offline additions survive even when the server record is newer.
   * Returns the list of merged fields (for the conflict journal).
   */
  private mergeAddedOrderItems(
    order: InstanceType<typeof Order>,
    payload: Record<string, unknown>,
  ): string[] {
    const incoming = payload.items;
    if (!Array.isArray(incoming) || incoming.length === 0) return [];

    const existingIds = new Set(
      order.items
        .map((item) => (item as { _id?: Types.ObjectId })._id)
        .filter((id): id is Types.ObjectId => Boolean(id))
        .map((id) => String(id)),
    );

    let added = 0;
    for (const raw of incoming) {
      if (!raw || typeof raw !== "object") continue;
      const candidate = raw as Record<string, unknown>;

      const candidateId = candidate._id ? String(candidate._id) : undefined;
      if (candidateId && existingIds.has(candidateId)) continue;

      if (!Types.ObjectId.isValid(String(candidate.menuItem))) continue;
      const quantity = Number(candidate.quantity);
      const price = Number(candidate.price);
      if (!Number.isFinite(quantity) || quantity < 1) continue;
      if (!Number.isFinite(price) || price < 0) continue;

      order.items.push({
        menuItem: new Types.ObjectId(String(candidate.menuItem)),
        quantity,
        price,
        specialInstructions:
          typeof candidate.specialInstructions === "string"
            ? candidate.specialInstructions
            : undefined,
        status: "pending",
      } as (typeof order.items)[number]);
      added += 1;
    }

    if (added === 0) return [];
    order.totalAmount = order.items.reduce(
      (sum, item) => sum + (item.finalPrice ?? item.price) * item.quantity,
      0,
    );
    return ["items", "totalAmount"];
  }
}

export const clientSyncService = new ClientSyncService();
