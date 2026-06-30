import mongoose, { Types } from "mongoose";
import KdsTicket, {
  IKdsTicket,
  IKdsStationItem,
  KdsStation,
} from "../models/KdsTicket";
import { writeAudit } from "./audit";

export interface Actor {
  id: string;
  role: string;
}

export interface PaceItemInput {
  itemId: Types.ObjectId | string;
  name: string;
  station: KdsStation;
  cookTimeMinutes: number;
}

const MS_PER_MINUTE = 60_000;

/**
 * Multi-station culinary pacing engine.
 *
 * Coordinates per-item fire times so every component of one order finishes at
 * the same moment. All synchronization is expressed through atomic, conditional
 * database writes — there is no in-process timer or local state — so the engine
 * is correct when run across any number of stateless server/worker instances.
 */
export class KdsPacingService {
  /**
   * Build the KDS ticket for a freshly created order.
   *
   * Let `Tmax` be the longest cook time across the order. Each item `i` is
   * delayed by `Tmax - cookTime_i` so the slowest dish anchors the plate-up and
   * faster dishes fire later. An item with zero delay (the slowest, and any tie)
   * fires immediately; the rest are held until their `targetFireTime`.
   */
  async paveTicket(
    orderId: Types.ObjectId | string,
    items: PaceItemInput[],
    actor?: Actor,
  ): Promise<IKdsTicket> {
    if (!Types.ObjectId.isValid(String(orderId))) {
      throw new Error("Invalid orderId");
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("A ticket requires at least one item");
    }

    const now = Date.now();
    const maxCookTime = items.reduce(
      (max, item) => Math.max(max, Math.max(0, item.cookTimeMinutes)),
      0,
    );

    const stationItems: IKdsStationItem[] = items.map((item) => {
      const cookTime = Math.max(0, item.cookTimeMinutes);
      const delayMinutes = maxCookTime - cookTime;
      const fireImmediately = delayMinutes <= 0;
      return {
        itemId: new Types.ObjectId(String(item.itemId)),
        name: item.name,
        station: item.station,
        cookTimeMinutes: cookTime,
        pacingStatus: fireImmediately ? "fired" : "hold",
        targetFireTime: new Date(now + delayMinutes * MS_PER_MINUTE),
        expoAlertSent: false,
      };
    });

    const hasFiredItem = stationItems.some(
      (item) => item.pacingStatus === "fired",
    );

    const session = await mongoose.startSession();
    try {
      let created: IKdsTicket | null = null;
      await session.withTransaction(async () => {
        const [ticket] = await KdsTicket.create(
          [
            {
              orderId: new Types.ObjectId(String(orderId)),
              ticketStatus: hasFiredItem ? "active" : "pending",
              stationItems,
            },
          ],
          { session },
        );
        created = ticket;

        if (actor) {
          await writeAudit(
            {
              userId: actor.id,
              userRole: actor.role,
              action: "PAVE_KDS_TICKET",
              targetType: "KdsTicket",
              targetId: ticket._id as Types.ObjectId,
              metadata: { orderId: String(orderId), maxCookTime },
            },
            session,
          );
        }
      });

      if (!created) throw new Error("Failed to create KDS ticket");
      return created;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Recurring job step: atomically promote every held item whose fire time has
   * elapsed to `fired`. The positional `arrayFilters` update is idempotent and
   * race-free, so concurrent worker replicas converge on the same result and
   * never double-fire. Returns the number of tickets touched.
   */
  async checkAndFirePacedItems(now: Date = new Date()): Promise<number> {
    const fired = await KdsTicket.updateMany(
      {
        "stationItems.pacingStatus": "hold",
        "stationItems.targetFireTime": { $lte: now },
      },
      { $set: { "stationItems.$[due].pacingStatus": "fired" } },
      {
        arrayFilters: [
          { "due.pacingStatus": "hold", "due.targetFireTime": { $lte: now } },
        ],
      },
    );

    // A still-pending ticket becomes active once any of its items has fired.
    await KdsTicket.updateMany(
      { ticketStatus: "pending", "stationItems.pacingStatus": "fired" },
      { $set: { ticketStatus: "active" } },
    );

    return fired.modifiedCount;
  }

  /**
   * Expedite an order: fire all remaining held items now and flag the ticket so
   * the line prioritises it. Used when a guest is waiting or a course was missed.
   */
  async expediteTicket(
    ticketId: Types.ObjectId | string,
    actor: Actor,
  ): Promise<IKdsTicket> {
    if (!Types.ObjectId.isValid(String(ticketId))) {
      throw new Error("Invalid ticketId");
    }

    const session = await mongoose.startSession();
    try {
      let updated: IKdsTicket | null = null;
      await session.withTransaction(async () => {
        const now = new Date();
        updated = await KdsTicket.findOneAndUpdate(
          { _id: ticketId },
          {
            $set: {
              ticketStatus: "expedited",
              "stationItems.$[held].pacingStatus": "fired",
              "stationItems.$[held].targetFireTime": now,
            },
          },
          {
            arrayFilters: [{ "held.pacingStatus": "hold" }],
            new: true,
            session,
          },
        );
        if (!updated) throw new Error("KDS ticket not found");

        await writeAudit(
          {
            userId: actor.id,
            userRole: actor.role,
            action: "EXPEDITE_KDS_TICKET",
            targetType: "KdsTicket",
            targetId: new Types.ObjectId(String(ticketId)),
          },
          session,
        );
      });

      if (!updated) throw new Error("KDS ticket not found");
      return updated;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Mark one station item as completed. When every item is completed the whole
   * ticket transitions to `completed`. The two-phase atomic update keeps the
   * aggregate ticket status consistent without reading-then-writing.
   */
  async markItemCompleted(
    ticketId: Types.ObjectId | string,
    itemId: Types.ObjectId | string,
    actor: Actor,
  ): Promise<IKdsTicket> {
    if (
      !Types.ObjectId.isValid(String(ticketId)) ||
      !Types.ObjectId.isValid(String(itemId))
    ) {
      throw new Error("Invalid ticketId or itemId");
    }

    const session = await mongoose.startSession();
    try {
      let updated: IKdsTicket | null = null;
      await session.withTransaction(async () => {
        updated = await KdsTicket.findOneAndUpdate(
          { _id: ticketId, "stationItems.itemId": itemId },
          { $set: { "stationItems.$.pacingStatus": "completed" } },
          { new: true, session },
        );
        if (!updated) throw new Error("KDS ticket or item not found");

        const allCompleted = updated.stationItems.every(
          (item) => item.pacingStatus === "completed",
        );
        if (allCompleted) {
          updated = await KdsTicket.findOneAndUpdate(
            { _id: ticketId },
            { $set: { ticketStatus: "completed" } },
            { new: true, session },
          );
        }

        await writeAudit(
          {
            userId: actor.id,
            userRole: actor.role,
            action: "COMPLETE_KDS_ITEM",
            targetType: "KdsTicket",
            targetId: new Types.ObjectId(String(ticketId)),
            metadata: { itemId: String(itemId) },
          },
          session,
        );
      });

      if (!updated) throw new Error("KDS ticket or item not found");
      return updated;
    } finally {
      await session.endSession();
    }
  }
}

export const kdsPacingService = new KdsPacingService();
