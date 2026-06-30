import mongoose, { ClientSession, Types } from "mongoose";
import { PurchaseOrder, Ingredient } from "../models/Supplier";
import InventoryBatch from "../models/InventoryBatch";
import Recipe from "../models/Recipe";
import InventoryAudit from "../models/InventoryAudit";
import WasteLog, { IWasteBatchConsumption } from "../models/WasteLog";
import { writeAudit } from "./audit";

export interface Actor {
  id: string;
  role: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_SHELF_LIFE_DAYS = 30;
const round2 = (value: number): number => Math.round(value * 100) / 100;

interface FifoDepletionResult {
  costConsumed: number;
  breakdown: IWasteBatchConsumption[];
  shortfall: number;
}

/**
 * Deplete `quantity` from an ingredient's batch pool oldest-first (FIFO) inside
 * the caller's transaction. Each decrement is guarded by a conditional `$inc`
 * so concurrent depletions can never oversell a batch.
 *
 * `strict` throws when the pool cannot cover the request (used by prep, which
 * must not produce without real stock). Non-strict callers (audit shrinkage
 * reconciliation) absorb the shortfall, valuing it at `fallbackUnitCost`.
 */
async function depleteBatchesFIFO(
  ingredientId: string,
  quantity: number,
  session: ClientSession,
  options: { strict: boolean; fallbackUnitCost?: number },
): Promise<FifoDepletionResult> {
  if (quantity <= 0) {
    return { costConsumed: 0, breakdown: [], shortfall: 0 };
  }

  const batches = await InventoryBatch.find({
    ingredientId,
    remainingQuantity: { $gt: 0 },
  })
    .sort({ receivedAt: 1, createdAt: 1 })
    .session(session);

  let outstanding = quantity;
  let costConsumed = 0;
  const breakdown: IWasteBatchConsumption[] = [];

  for (const batch of batches) {
    if (outstanding <= 0) break;

    const take = Math.min(outstanding, batch.remainingQuantity);
    const result = await InventoryBatch.updateOne(
      { _id: batch._id, remainingQuantity: { $gte: take } },
      { $inc: { remainingQuantity: -take } },
      { session },
    );
    if (result.modifiedCount !== 1) {
      throw new Error(`BATCH_CONTENTION:${String(batch._id)}`);
    }

    costConsumed += take * batch.unitCost;
    breakdown.push({
      batchId: batch._id as Types.ObjectId,
      quantity: take,
      unitCost: batch.unitCost,
    });
    outstanding -= take;
  }

  if (outstanding > 0 && options.strict) {
    throw new Error(`INSUFFICIENT_BATCH_STOCK:${ingredientId}`);
  }

  if (outstanding > 0) {
    costConsumed += outstanding * (options.fallbackUnitCost ?? 0);
  }

  return {
    costConsumed: round2(costConsumed),
    breakdown,
    shortfall: outstanding > 0 ? outstanding : 0,
  };
}

// ---------------------------------------------------------------------------
// A. Receive a purchase order (goods intake)
// ---------------------------------------------------------------------------

export interface ReceivedItemInput {
  ingredientId: string;
  quantity: number;
  unitCost: number;
  expiryDate?: Date | string;
}

export interface ReceivePurchaseOrderResult {
  purchaseOrderId: string;
  status: string;
  batchesCreated: number;
  totalReceivedValue: number;
}

const RECEIVABLE_STATUSES = ["ordered", "partially_received"];

export class ReceivePurchaseOrderUseCase {
  async execute(
    purchaseOrderId: string,
    receivedItems: ReceivedItemInput[],
    actor: Actor,
  ): Promise<ReceivePurchaseOrderResult> {
    const safeId = String(purchaseOrderId);
    if (!Types.ObjectId.isValid(safeId)) {
      throw new Error("Invalid purchaseOrderId");
    }
    if (!Array.isArray(receivedItems) || receivedItems.length === 0) {
      throw new Error("receivedItems must be a non-empty array");
    }

    const session = await mongoose.startSession();
    try {
      let result: ReceivePurchaseOrderResult | null = null;

      await session.withTransaction(async () => {
        const po = await PurchaseOrder.findById(safeId).session(session);
        if (!po) throw new Error("Purchase order not found");
        if (!RECEIVABLE_STATUSES.includes(po.status)) {
          throw new Error(
            `Purchase order must be 'ordered' or 'partially_received' to receive (current: ${po.status})`,
          );
        }

        let batchesCreated = 0;
        let totalReceivedValue = 0;
        const now = new Date();

        for (const raw of receivedItems) {
          const ingredientId = String(raw.ingredientId);
          const quantity = Number(raw.quantity);
          const unitCost = Number(raw.unitCost);

          if (!Types.ObjectId.isValid(ingredientId)) {
            throw new Error(`Invalid ingredientId: ${ingredientId}`);
          }
          if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error("Received quantity must be a positive number");
          }
          if (!Number.isFinite(unitCost) || unitCost < 0) {
            throw new Error("unitCost must be a non-negative number");
          }

          const poItem = po.items.find(
            (item) => String(item.ingredient) === ingredientId,
          );
          if (!poItem) {
            throw new Error(
              `Ingredient ${ingredientId} is not on this purchase order`,
            );
          }

          poItem.receivedQuantity = (poItem.receivedQuantity ?? 0) + quantity;

          const ingredient = await Ingredient.findById(ingredientId).session(
            session,
          );
          const expiryDate = raw.expiryDate
            ? new Date(raw.expiryDate)
            : new Date(
                now.getTime() +
                  (ingredient?.shelfLife ?? DEFAULT_SHELF_LIFE_DAYS) *
                    MS_PER_DAY,
              );
          if (Number.isNaN(expiryDate.getTime())) {
            throw new Error("Invalid expiryDate");
          }

          await InventoryBatch.create(
            [
              {
                ingredientId,
                initialQuantity: quantity,
                remainingQuantity: quantity,
                unitCost,
                expiryDate,
                receivedAt: now,
              },
            ],
            { session },
          );
          batchesCreated += 1;
          totalReceivedValue += quantity * unitCost;

          await Ingredient.updateOne(
            { _id: ingredientId },
            { $inc: { currentStock: quantity } },
            { session },
          );
        }

        const fullyReceived = po.items.every(
          (item) => (item.receivedQuantity ?? 0) >= item.quantity,
        );
        po.status = fullyReceived ? "received" : "partially_received";
        if (fullyReceived) {
          po.receivedAt = now;
          po.actualDelivery = now;
        }
        await po.save({ session });

        await writeAudit(
          {
            userId: actor.id,
            userRole: actor.role,
            action: "RECEIVE_PURCHASE_ORDER",
            targetType: "PurchaseOrder",
            targetId: po._id as Types.ObjectId,
            metadata: {
              status: po.status,
              batchesCreated,
              totalReceivedValue: round2(totalReceivedValue),
            },
          },
          session,
        );

        result = {
          purchaseOrderId: safeId,
          status: po.status,
          batchesCreated,
          totalReceivedValue: round2(totalReceivedValue),
        };
      });

      if (!result) throw new Error("Failed to receive purchase order");
      return result;
    } finally {
      await session.endSession();
    }
  }
}

// ---------------------------------------------------------------------------
// B. Prep an intermediate (in-house produced) ingredient
// ---------------------------------------------------------------------------

export interface PrepIngredientResult {
  preppedIngredientId: string;
  producedQuantity: number;
  totalInputCost: number;
  unitCost: number;
}

export class PrepIngredientUseCase {
  async execute(
    preppedIngredientId: string,
    quantityToProduce: number,
    actor: Actor,
  ): Promise<PrepIngredientResult> {
    const safeId = String(preppedIngredientId);
    const quantity = Number(quantityToProduce);
    if (!Types.ObjectId.isValid(safeId)) {
      throw new Error("Invalid preppedIngredientId");
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("quantityToProduce must be a positive number");
    }

    const session = await mongoose.startSession();
    try {
      let result: PrepIngredientResult | null = null;

      await session.withTransaction(async () => {
        const prepped = await Ingredient.findById(safeId).session(session);
        if (!prepped) throw new Error("Prepped ingredient not found");
        if (!prepped.isPrepped) {
          throw new Error("Target ingredient is not marked isPrepped");
        }

        const recipe = await Recipe.findOne({
          targetId: prepped._id,
          targetType: "Ingredient",
        }).session(session);
        if (!recipe) {
          throw new Error("No recipe (BOM) defined for this prepped ingredient");
        }

        // Recipe component quantities are specified per 1 unit of output.
        let totalInputCost = 0;
        for (const component of recipe.ingredients) {
          const requiredGross = component.grossQuantity * quantity;
          if (requiredGross <= 0) continue;

          const depletion = await depleteBatchesFIFO(
            component.ingredientId,
            requiredGross,
            session,
            { strict: true },
          );
          totalInputCost += depletion.costConsumed;

          await Ingredient.updateOne(
            { _id: component.ingredientId },
            { $inc: { currentStock: -requiredGross } },
            { session },
          );
        }

        const unitCost = round2(totalInputCost / quantity);
        const expiryDate = new Date(
          Date.now() +
            (prepped.shelfLife ?? DEFAULT_SHELF_LIFE_DAYS) * MS_PER_DAY,
        );

        await InventoryBatch.create(
          [
            {
              ingredientId: safeId,
              initialQuantity: quantity,
              remainingQuantity: quantity,
              unitCost,
              expiryDate,
              receivedAt: new Date(),
            },
          ],
          { session },
        );

        await Ingredient.updateOne(
          { _id: safeId },
          { $inc: { currentStock: quantity } },
          { session },
        );

        await writeAudit(
          {
            userId: actor.id,
            userRole: actor.role,
            action: "PREP_INGREDIENT",
            targetType: "Ingredient",
            targetId: prepped._id as Types.ObjectId,
            metadata: {
              producedQuantity: quantity,
              unitCost,
              totalInputCost: round2(totalInputCost),
            },
          },
          session,
        );

        result = {
          preppedIngredientId: safeId,
          producedQuantity: quantity,
          totalInputCost: round2(totalInputCost),
          unitCost,
        };
      });

      if (!result) throw new Error("Failed to prep ingredient");
      return result;
    } finally {
      await session.endSession();
    }
  }
}

// ---------------------------------------------------------------------------
// C. Submit a physical inventory audit (stocktake reconciliation)
// ---------------------------------------------------------------------------

export interface AuditCountInput {
  ingredientId: string;
  actualStock: number;
}

export interface SubmitInventoryAuditResult {
  auditId: string;
  status: string;
  totalVarianceCost: number;
  shrinkageCost: number;
  itemsReconciled: number;
}

export class SubmitInventoryAuditUseCase {
  async execute(
    auditId: string,
    items: AuditCountInput[],
    actor: Actor,
  ): Promise<SubmitInventoryAuditResult> {
    const safeId = String(auditId);
    if (!Types.ObjectId.isValid(safeId)) {
      throw new Error("Invalid auditId");
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Audit items must be a non-empty array");
    }

    const session = await mongoose.startSession();
    try {
      let result: SubmitInventoryAuditResult | null = null;

      await session.withTransaction(async () => {
        const audit = await InventoryAudit.findById(safeId).session(session);
        if (!audit) throw new Error("Inventory audit not found");
        if (audit.status === "submitted") {
          throw new Error("Audit is already submitted and sealed");
        }

        const reconciledItems = [];
        let totalVarianceCost = 0;
        let shrinkageCost = 0;

        for (const raw of items) {
          const ingredientId = String(raw.ingredientId);
          const actualStock = Number(raw.actualStock);
          if (!Types.ObjectId.isValid(ingredientId)) {
            throw new Error(`Invalid ingredientId: ${ingredientId}`);
          }
          if (!Number.isFinite(actualStock) || actualStock < 0) {
            throw new Error("actualStock must be a non-negative number");
          }

          const ingredient = await Ingredient.findById(ingredientId).session(
            session,
          );
          if (!ingredient) {
            throw new Error(`Ingredient not found: ${ingredientId}`);
          }

          const theoreticalStock = ingredient.currentStock;
          const variance = round2(actualStock - theoreticalStock);
          let varianceCost = 0;

          if (variance < 0) {
            // Shrinkage: deplete the missing quantity FIFO and log it as waste.
            const depletion = await depleteBatchesFIFO(
              ingredientId,
              -variance,
              session,
              { strict: false, fallbackUnitCost: ingredient.costPerUnit },
            );
            varianceCost = -depletion.costConsumed;
            shrinkageCost += depletion.costConsumed;

            await WasteLog.create(
              [
                {
                  ingredientId,
                  quantity: -variance,
                  unit: ingredient.unit,
                  costLost: depletion.costConsumed,
                  reason: "discrepancy",
                  loggedBy: actor.id,
                  batchBreakdown: depletion.breakdown,
                },
              ],
              { session },
            );
          } else if (variance > 0) {
            // Overage: book the surplus as a batch so the FIFO pool stays in
            // sync with the reconciled currentStock.
            varianceCost = round2(variance * ingredient.costPerUnit);
            await InventoryBatch.create(
              [
                {
                  ingredientId,
                  initialQuantity: variance,
                  remainingQuantity: variance,
                  unitCost: ingredient.costPerUnit,
                  expiryDate: new Date(
                    Date.now() +
                      (ingredient.shelfLife ?? DEFAULT_SHELF_LIFE_DAYS) *
                        MS_PER_DAY,
                  ),
                  receivedAt: new Date(),
                },
              ],
              { session },
            );
          }

          await Ingredient.updateOne(
            { _id: ingredientId },
            { $set: { currentStock: actualStock } },
            { session },
          );

          totalVarianceCost += varianceCost;
          reconciledItems.push({
            ingredientId,
            theoreticalStock,
            actualStock,
            variance,
            varianceCost,
          });
        }

        audit.items = reconciledItems;
        audit.status = "submitted";
        audit.auditDate = audit.auditDate ?? new Date();
        await audit.save({ session });

        await writeAudit(
          {
            userId: actor.id,
            userRole: actor.role,
            action: "SUBMIT_INVENTORY_AUDIT",
            targetType: "InventoryAudit",
            targetId: audit._id as Types.ObjectId,
            metadata: {
              totalVarianceCost: round2(totalVarianceCost),
              shrinkageCost: round2(shrinkageCost),
              itemsReconciled: reconciledItems.length,
            },
          },
          session,
        );

        result = {
          auditId: safeId,
          status: audit.status,
          totalVarianceCost: round2(totalVarianceCost),
          shrinkageCost: round2(shrinkageCost),
          itemsReconciled: reconciledItems.length,
        };
      });

      if (!result) throw new Error("Failed to submit inventory audit");
      return result;
    } finally {
      await session.endSession();
    }
  }
}

// ---------------------------------------------------------------------------
// Variance / shrinkage reporting
// ---------------------------------------------------------------------------

export interface VarianceReport {
  generatedAt: Date;
  windowDays: number;
  discrepancyWasteCost: number;
  discrepancyEvents: number;
  recentAudits: Array<{
    auditId: string;
    auditDate: Date;
    auditedBy: string;
    totalVarianceCost: number;
    itemCount: number;
  }>;
  topShrinkingIngredients: Array<{
    ingredientId: string;
    totalQuantityLost: number;
    totalCostLost: number;
  }>;
}

export class InventoryVarianceReportService {
  async getReport(windowDays = 30): Promise<VarianceReport> {
    const safeWindow =
      Number.isFinite(windowDays) && windowDays > 0
        ? Math.floor(windowDays)
        : 30;
    const cutoff = new Date(Date.now() - safeWindow * MS_PER_DAY);

    const [wasteAgg, topShrinking, recentAuditsRaw] = await Promise.all([
      WasteLog.aggregate<{ _id: null; cost: number; count: number }>([
        { $match: { reason: "discrepancy", createdAt: { $gte: cutoff } } },
        { $group: { _id: null, cost: { $sum: "$costLost" }, count: { $sum: 1 } } },
      ]),
      WasteLog.aggregate<{
        _id: string;
        totalQuantityLost: number;
        totalCostLost: number;
      }>([
        { $match: { reason: "discrepancy", createdAt: { $gte: cutoff } } },
        {
          $group: {
            _id: "$ingredientId",
            totalQuantityLost: { $sum: "$quantity" },
            totalCostLost: { $sum: "$costLost" },
          },
        },
        { $sort: { totalCostLost: -1 } },
        { $limit: 10 },
      ]),
      InventoryAudit.find({ status: "submitted", auditDate: { $gte: cutoff } })
        .sort({ auditDate: -1 })
        .limit(20)
        .lean(),
    ]);

    const recentAudits = recentAuditsRaw.map((audit) => ({
      auditId: String(audit._id),
      auditDate: audit.auditDate,
      auditedBy: audit.auditedBy,
      totalVarianceCost: round2(
        (audit.items ?? []).reduce(
          (sum, item) => sum + (item.varianceCost ?? 0),
          0,
        ),
      ),
      itemCount: (audit.items ?? []).length,
    }));

    return {
      generatedAt: new Date(),
      windowDays: safeWindow,
      discrepancyWasteCost: round2(wasteAgg[0]?.cost ?? 0),
      discrepancyEvents: wasteAgg[0]?.count ?? 0,
      recentAudits,
      topShrinkingIngredients: topShrinking.map((row) => ({
        ingredientId: row._id,
        totalQuantityLost: round2(row.totalQuantityLost),
        totalCostLost: round2(row.totalCostLost),
      })),
    };
  }
}

// ---------------------------------------------------------------------------
// D. Audit lifecycle: create draft, count sheet, history
// ---------------------------------------------------------------------------

export interface CreateAuditDraftResult {
  auditId: string;
  status: string;
  auditDate: Date;
}

export class CreateAuditDraftUseCase {
  async execute(actor: Actor): Promise<CreateAuditDraftResult> {
    // A draft is an empty placeholder; the meaningful, immutable AuditLog entry
    // is written by SubmitInventoryAuditUseCase when the reconciliation lands.
    const audit = await InventoryAudit.create({
      auditedBy: actor.id,
      auditDate: new Date(),
      status: "draft",
      items: [],
    });

    return {
      auditId: String(audit._id),
      status: audit.status,
      auditDate: audit.auditDate,
    };
  }
}

export interface AuditSheetRow {
  ingredientId: string;
  name: string;
  unit: string;
  category: string;
  theoreticalStock: number;
  costPerUnit: number;
  isPrepped: boolean;
  storageRequirement: string;
}

export interface AuditSummary {
  auditId: string;
  auditDate: Date;
  auditedBy: string;
  status: string;
  itemCount: number;
  totalVarianceCost: number;
}

export class InventoryAuditQueryService {
  /**
   * The count sheet the tablet walks the kitchen with: every active ingredient
   * plus its current (theoretical) stock to be counted against.
   */
  async getCountSheet(): Promise<AuditSheetRow[]> {
    const ingredients = await Ingredient.find({ isActive: true })
      .select("name unit category currentStock costPerUnit isPrepped storageRequirement")
      .sort({ category: 1, name: 1 })
      .lean();

    return ingredients.map((ingredient) => ({
      ingredientId: String(ingredient._id),
      name: ingredient.name,
      unit: ingredient.unit,
      category: ingredient.category,
      theoreticalStock: ingredient.currentStock ?? 0,
      costPerUnit: ingredient.costPerUnit ?? 0,
      isPrepped: Boolean(ingredient.isPrepped),
      storageRequirement: ingredient.storageRequirement,
    }));
  }

  async listAudits(limit = 50): Promise<AuditSummary[]> {
    const safeLimit =
      Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 50;
    const audits = await InventoryAudit.find()
      .sort({ auditDate: -1 })
      .limit(safeLimit)
      .lean();

    return audits.map((audit) => ({
      auditId: String(audit._id),
      auditDate: audit.auditDate,
      auditedBy: audit.auditedBy,
      status: audit.status,
      itemCount: (audit.items ?? []).length,
      totalVarianceCost: round2(
        (audit.items ?? []).reduce(
          (sum, item) => sum + (item.varianceCost ?? 0),
          0,
        ),
      ),
    }));
  }

  async getAudit(auditId: string) {
    const safeId = String(auditId);
    if (!Types.ObjectId.isValid(safeId)) {
      throw new Error("Invalid auditId");
    }
    const audit = await InventoryAudit.findById(safeId).lean();
    if (!audit) throw new Error("Inventory audit not found");
    return audit;
  }
}

export const receivePurchaseOrderUseCase = new ReceivePurchaseOrderUseCase();
export const prepIngredientUseCase = new PrepIngredientUseCase();
export const submitInventoryAuditUseCase = new SubmitInventoryAuditUseCase();
export const createAuditDraftUseCase = new CreateAuditDraftUseCase();
export const inventoryAuditQueryService = new InventoryAuditQueryService();
export const inventoryVarianceReportService =
  new InventoryVarianceReportService();
