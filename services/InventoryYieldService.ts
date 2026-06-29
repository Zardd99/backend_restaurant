import mongoose, { Types } from "mongoose";
import InventoryBatch from "../models/InventoryBatch";
import WasteLog, {
  IWasteLog,
  IWasteBatchConsumption,
  WasteReason,
  WASTE_REASONS,
} from "../models/WasteLog";
import { Ingredient as IngredientModel } from "../models/Supplier";
import { writeAudit } from "./audit";

export interface Actor {
  id: string;
  role: string;
}

export interface ReceiveBatchInput {
  ingredientId: string;
  quantity: number;
  unitCost: number;
  expiryDate: Date;
}

export interface CogsBreakdown {
  beginningInventoryCost: number;
  purchasesCost: number;
  endingInventoryCost: number;
  wasteCost: number;
  cogs: number;
  window: { startDate: Date; endDate: Date };
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Supply-chain costing service: FIFO batch valuation, secure waste logging, and
 * exact Cost-of-Goods-Sold reporting. Every multi-collection mutation runs in a
 * Mongoose transaction; FIFO deductions use conditional `$inc` guards so two
 * concurrent depletions can never drive a batch negative.
 */
export class InventoryYieldService {
  /** Record a received delivery as a new costed batch. */
  async receiveBatch(
    input: ReceiveBatchInput,
    actor: Actor,
  ): Promise<void> {
    const ingredientId = String(input.ingredientId).trim();
    const quantity = Number(input.quantity);
    const unitCost = Number(input.unitCost);
    const expiryDate = new Date(input.expiryDate);

    if (!ingredientId) throw new Error("ingredientId is required");
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("quantity must be a positive number");
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      throw new Error("unitCost must be a non-negative number");
    }
    if (Number.isNaN(expiryDate.getTime())) {
      throw new Error("expiryDate must be a valid date");
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const [batch] = await InventoryBatch.create(
          [
            {
              ingredientId,
              initialQuantity: quantity,
              remainingQuantity: quantity,
              unitCost,
              expiryDate,
              receivedAt: new Date(),
            },
          ],
          { session },
        );

        if (Types.ObjectId.isValid(ingredientId)) {
          await IngredientModel.updateOne(
            { _id: ingredientId },
            { $inc: { currentStock: quantity }, $set: { lastRestocked: new Date() } },
            { session },
          );
        }

        await writeAudit(
          {
            userId: actor.id,
            userRole: actor.role,
            action: "RECEIVE_INVENTORY",
            targetType: "InventoryBatch",
            targetId: batch._id as Types.ObjectId,
            metadata: { ingredientId, quantity, unitCost },
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * Deduct `quantity` of an ingredient from the live batch pool using FIFO
   * (oldest non-expired batch first), price the loss from the actual depleted
   * batches, and append an immutable {@link WasteLog} entry — all atomically.
   */
  async logWaste(
    ingredientId: string,
    quantity: number,
    reason: WasteReason,
    userId: string,
    unit: string,
  ): Promise<IWasteLog> {
    const safeIngredientId = String(ingredientId).trim();
    const safeQuantity = Number(quantity);
    const safeUnit = String(unit).trim();

    if (!safeIngredientId) throw new Error("ingredientId is required");
    if (!Number.isFinite(safeQuantity) || safeQuantity <= 0) {
      throw new Error("quantity must be a positive number");
    }
    if (!safeUnit) throw new Error("unit is required");
    if (!WASTE_REASONS.includes(reason)) {
      throw new Error("Invalid waste reason");
    }

    const session = await mongoose.startSession();
    try {
      let wasteLog: IWasteLog | null = null;

      await session.withTransaction(async () => {
        const now = new Date();
        const batches = await InventoryBatch.find({
          ingredientId: safeIngredientId,
          remainingQuantity: { $gt: 0 },
          expiryDate: { $gte: now },
        })
          .sort({ receivedAt: 1, createdAt: 1 })
          .session(session);

        let outstanding = safeQuantity;
        let costLost = 0;
        const breakdown: IWasteBatchConsumption[] = [];

        for (const batch of batches) {
          if (outstanding <= 0) break;

          const take = Math.min(outstanding, batch.remainingQuantity);
          // Conditional guard: only deduct if the batch still holds `take`.
          const result = await InventoryBatch.updateOne(
            { _id: batch._id, remainingQuantity: { $gte: take } },
            { $inc: { remainingQuantity: -take } },
            { session },
          );
          if (result.modifiedCount !== 1) {
            throw new Error(
              `BATCH_CONTENTION:${String(batch._id)} — retry waste log`,
            );
          }

          costLost += take * batch.unitCost;
          breakdown.push({
            batchId: batch._id as Types.ObjectId,
            quantity: take,
            unitCost: batch.unitCost,
          });
          outstanding -= take;
        }

        if (outstanding > 0) {
          throw new Error(`INSUFFICIENT_BATCH_STOCK:${safeIngredientId}`);
        }

        if (Types.ObjectId.isValid(safeIngredientId)) {
          await IngredientModel.updateOne(
            { _id: safeIngredientId },
            { $inc: { currentStock: -safeQuantity } },
            { session },
          );
        }

        const [created] = await WasteLog.create(
          [
            {
              ingredientId: safeIngredientId,
              quantity: safeQuantity,
              unit: safeUnit,
              costLost: round2(costLost),
              reason,
              loggedBy: userId,
              batchBreakdown: breakdown,
            },
          ],
          { session },
        );
        wasteLog = created;

        await writeAudit(
          {
            userId,
            userRole: "system",
            action: "LOG_WASTE",
            targetType: "WasteLog",
            targetId: created._id as Types.ObjectId,
            reason,
            metadata: {
              ingredientId: safeIngredientId,
              quantity: safeQuantity,
              costLost: round2(costLost),
            },
          },
          session,
        );
      });

      if (!wasteLog) throw new Error("Failed to write waste log");
      return wasteLog;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Exact COGS over a window:
   *
   *   COGS = Beginning Inventory + Purchases − Ending Inventory − Waste
   *
   * Each component is computed by a single grouped aggregation against the
   * batch ledger and the waste ledger (no per-document round-trips):
   *  - Beginning inventory = cost basis of batches received before `startDate`.
   *  - Purchases           = cost basis of batches received within the window.
   *  - Ending inventory    = live valuation of all unconsumed batch quantity.
   *  - Waste               = `costLost` summed over the window's waste entries.
   */
  async calculateRealCOGS(
    startDate: Date,
    endDate: Date,
  ): Promise<CogsBreakdown> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error("startDate and endDate must be valid dates");
    }
    if (start > end) {
      throw new Error("startDate must not be after endDate");
    }

    const [beginningAgg, purchasesAgg, endingAgg, wasteAgg] = await Promise.all([
      InventoryBatch.aggregate<{ cost: number }>([
        { $match: { receivedAt: { $lt: start } } },
        {
          $group: {
            _id: null,
            cost: { $sum: { $multiply: ["$initialQuantity", "$unitCost"] } },
          },
        },
      ]),
      InventoryBatch.aggregate<{ cost: number }>([
        { $match: { receivedAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: null,
            cost: { $sum: { $multiply: ["$initialQuantity", "$unitCost"] } },
          },
        },
      ]),
      InventoryBatch.aggregate<{ cost: number }>([
        {
          $group: {
            _id: null,
            cost: { $sum: { $multiply: ["$remainingQuantity", "$unitCost"] } },
          },
        },
      ]),
      WasteLog.aggregate<{ cost: number }>([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, cost: { $sum: "$costLost" } } },
      ]),
    ]);

    const beginningInventoryCost = round2(beginningAgg[0]?.cost ?? 0);
    const purchasesCost = round2(purchasesAgg[0]?.cost ?? 0);
    const endingInventoryCost = round2(endingAgg[0]?.cost ?? 0);
    const wasteCost = round2(wasteAgg[0]?.cost ?? 0);

    const cogs = round2(
      beginningInventoryCost + purchasesCost - endingInventoryCost - wasteCost,
    );

    return {
      beginningInventoryCost,
      purchasesCost,
      endingInventoryCost,
      wasteCost,
      cogs,
      window: { startDate: start, endDate: end },
    };
  }
}

export const inventoryYieldService = new InventoryYieldService();
