"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoryVarianceReportService = exports.inventoryAuditQueryService = exports.createAuditDraftUseCase = exports.submitInventoryAuditUseCase = exports.prepIngredientUseCase = exports.receivePurchaseOrderUseCase = exports.InventoryAuditQueryService = exports.CreateAuditDraftUseCase = exports.InventoryVarianceReportService = exports.SubmitInventoryAuditUseCase = exports.PrepIngredientUseCase = exports.ReceivePurchaseOrderUseCase = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const Supplier_1 = require("../models/Supplier");
const InventoryBatch_1 = __importDefault(require("../models/InventoryBatch"));
const Recipe_1 = __importDefault(require("../models/Recipe"));
const InventoryAudit_1 = __importDefault(require("../models/InventoryAudit"));
const WasteLog_1 = __importDefault(require("../models/WasteLog"));
const audit_1 = require("./audit");
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_SHELF_LIFE_DAYS = 30;
const round2 = (value) => Math.round(value * 100) / 100;
async function depleteBatchesFIFO(ingredientId, quantity, session, options) {
    var _a;
    if (quantity <= 0) {
        return { costConsumed: 0, breakdown: [], shortfall: 0 };
    }
    const batches = await InventoryBatch_1.default.find({
        ingredientId,
        remainingQuantity: { $gt: 0 },
    })
        .sort({ receivedAt: 1, createdAt: 1 })
        .session(session);
    let outstanding = quantity;
    let costConsumed = 0;
    const breakdown = [];
    for (const batch of batches) {
        if (outstanding <= 0)
            break;
        const take = Math.min(outstanding, batch.remainingQuantity);
        const result = await InventoryBatch_1.default.updateOne({ _id: batch._id, remainingQuantity: { $gte: take } }, { $inc: { remainingQuantity: -take } }, { session });
        if (result.modifiedCount !== 1) {
            throw new Error(`BATCH_CONTENTION:${String(batch._id)}`);
        }
        costConsumed += take * batch.unitCost;
        breakdown.push({
            batchId: batch._id,
            quantity: take,
            unitCost: batch.unitCost,
        });
        outstanding -= take;
    }
    if (outstanding > 0 && options.strict) {
        throw new Error(`INSUFFICIENT_BATCH_STOCK:${ingredientId}`);
    }
    if (outstanding > 0) {
        costConsumed += outstanding * ((_a = options.fallbackUnitCost) !== null && _a !== void 0 ? _a : 0);
    }
    return {
        costConsumed: round2(costConsumed),
        breakdown,
        shortfall: outstanding > 0 ? outstanding : 0,
    };
}
const RECEIVABLE_STATUSES = ["ordered", "partially_received"];
class ReceivePurchaseOrderUseCase {
    async execute(purchaseOrderId, receivedItems, actor) {
        const safeId = String(purchaseOrderId);
        if (!mongoose_1.Types.ObjectId.isValid(safeId)) {
            throw new Error("Invalid purchaseOrderId");
        }
        if (!Array.isArray(receivedItems) || receivedItems.length === 0) {
            throw new Error("receivedItems must be a non-empty array");
        }
        const session = await mongoose_1.default.startSession();
        try {
            let result = null;
            await session.withTransaction(async () => {
                var _a, _b;
                const po = await Supplier_1.PurchaseOrder.findById(safeId).session(session);
                if (!po)
                    throw new Error("Purchase order not found");
                if (!RECEIVABLE_STATUSES.includes(po.status)) {
                    throw new Error(`Purchase order must be 'ordered' or 'partially_received' to receive (current: ${po.status})`);
                }
                let batchesCreated = 0;
                let totalReceivedValue = 0;
                const now = new Date();
                for (const raw of receivedItems) {
                    const ingredientId = String(raw.ingredientId);
                    const quantity = Number(raw.quantity);
                    const unitCost = Number(raw.unitCost);
                    if (!mongoose_1.Types.ObjectId.isValid(ingredientId)) {
                        throw new Error(`Invalid ingredientId: ${ingredientId}`);
                    }
                    if (!Number.isFinite(quantity) || quantity <= 0) {
                        throw new Error("Received quantity must be a positive number");
                    }
                    if (!Number.isFinite(unitCost) || unitCost < 0) {
                        throw new Error("unitCost must be a non-negative number");
                    }
                    const poItem = po.items.find((item) => String(item.ingredient) === ingredientId);
                    if (!poItem) {
                        throw new Error(`Ingredient ${ingredientId} is not on this purchase order`);
                    }
                    poItem.receivedQuantity = ((_a = poItem.receivedQuantity) !== null && _a !== void 0 ? _a : 0) + quantity;
                    const ingredient = await Supplier_1.Ingredient.findById(ingredientId).session(session);
                    const expiryDate = raw.expiryDate
                        ? new Date(raw.expiryDate)
                        : new Date(now.getTime() +
                            ((_b = ingredient === null || ingredient === void 0 ? void 0 : ingredient.shelfLife) !== null && _b !== void 0 ? _b : DEFAULT_SHELF_LIFE_DAYS) *
                                MS_PER_DAY);
                    if (Number.isNaN(expiryDate.getTime())) {
                        throw new Error("Invalid expiryDate");
                    }
                    await InventoryBatch_1.default.create([
                        {
                            ingredientId,
                            initialQuantity: quantity,
                            remainingQuantity: quantity,
                            unitCost,
                            expiryDate,
                            receivedAt: now,
                        },
                    ], { session });
                    batchesCreated += 1;
                    totalReceivedValue += quantity * unitCost;
                    await Supplier_1.Ingredient.updateOne({ _id: ingredientId }, { $inc: { currentStock: quantity } }, { session });
                }
                const fullyReceived = po.items.every((item) => { var _a; return ((_a = item.receivedQuantity) !== null && _a !== void 0 ? _a : 0) >= item.quantity; });
                po.status = fullyReceived ? "received" : "partially_received";
                if (fullyReceived) {
                    po.receivedAt = now;
                    po.actualDelivery = now;
                }
                await po.save({ session });
                await (0, audit_1.writeAudit)({
                    userId: actor.id,
                    userRole: actor.role,
                    action: "RECEIVE_PURCHASE_ORDER",
                    targetType: "PurchaseOrder",
                    targetId: po._id,
                    metadata: {
                        status: po.status,
                        batchesCreated,
                        totalReceivedValue: round2(totalReceivedValue),
                    },
                }, session);
                result = {
                    purchaseOrderId: safeId,
                    status: po.status,
                    batchesCreated,
                    totalReceivedValue: round2(totalReceivedValue),
                };
            });
            if (!result)
                throw new Error("Failed to receive purchase order");
            return result;
        }
        finally {
            await session.endSession();
        }
    }
}
exports.ReceivePurchaseOrderUseCase = ReceivePurchaseOrderUseCase;
class PrepIngredientUseCase {
    async execute(preppedIngredientId, quantityToProduce, actor) {
        const safeId = String(preppedIngredientId);
        const quantity = Number(quantityToProduce);
        if (!mongoose_1.Types.ObjectId.isValid(safeId)) {
            throw new Error("Invalid preppedIngredientId");
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error("quantityToProduce must be a positive number");
        }
        const session = await mongoose_1.default.startSession();
        try {
            let result = null;
            await session.withTransaction(async () => {
                var _a;
                const prepped = await Supplier_1.Ingredient.findById(safeId).session(session);
                if (!prepped)
                    throw new Error("Prepped ingredient not found");
                if (!prepped.isPrepped) {
                    throw new Error("Target ingredient is not marked isPrepped");
                }
                const recipe = await Recipe_1.default.findOne({
                    targetId: prepped._id,
                    targetType: "Ingredient",
                }).session(session);
                if (!recipe) {
                    throw new Error("No recipe (BOM) defined for this prepped ingredient");
                }
                let totalInputCost = 0;
                for (const component of recipe.ingredients) {
                    const requiredGross = component.grossQuantity * quantity;
                    if (requiredGross <= 0)
                        continue;
                    const depletion = await depleteBatchesFIFO(component.ingredientId, requiredGross, session, { strict: true });
                    totalInputCost += depletion.costConsumed;
                    await Supplier_1.Ingredient.updateOne({ _id: component.ingredientId }, { $inc: { currentStock: -requiredGross } }, { session });
                }
                const unitCost = round2(totalInputCost / quantity);
                const expiryDate = new Date(Date.now() +
                    ((_a = prepped.shelfLife) !== null && _a !== void 0 ? _a : DEFAULT_SHELF_LIFE_DAYS) * MS_PER_DAY);
                await InventoryBatch_1.default.create([
                    {
                        ingredientId: safeId,
                        initialQuantity: quantity,
                        remainingQuantity: quantity,
                        unitCost,
                        expiryDate,
                        receivedAt: new Date(),
                    },
                ], { session });
                await Supplier_1.Ingredient.updateOne({ _id: safeId }, { $inc: { currentStock: quantity } }, { session });
                await (0, audit_1.writeAudit)({
                    userId: actor.id,
                    userRole: actor.role,
                    action: "PREP_INGREDIENT",
                    targetType: "Ingredient",
                    targetId: prepped._id,
                    metadata: {
                        producedQuantity: quantity,
                        unitCost,
                        totalInputCost: round2(totalInputCost),
                    },
                }, session);
                result = {
                    preppedIngredientId: safeId,
                    producedQuantity: quantity,
                    totalInputCost: round2(totalInputCost),
                    unitCost,
                };
            });
            if (!result)
                throw new Error("Failed to prep ingredient");
            return result;
        }
        finally {
            await session.endSession();
        }
    }
}
exports.PrepIngredientUseCase = PrepIngredientUseCase;
class SubmitInventoryAuditUseCase {
    async execute(auditId, items, actor) {
        const safeId = String(auditId);
        if (!mongoose_1.Types.ObjectId.isValid(safeId)) {
            throw new Error("Invalid auditId");
        }
        if (!Array.isArray(items) || items.length === 0) {
            throw new Error("Audit items must be a non-empty array");
        }
        const session = await mongoose_1.default.startSession();
        try {
            let result = null;
            await session.withTransaction(async () => {
                var _a, _b;
                const audit = await InventoryAudit_1.default.findById(safeId).session(session);
                if (!audit)
                    throw new Error("Inventory audit not found");
                if (audit.status === "submitted") {
                    throw new Error("Audit is already submitted and sealed");
                }
                const reconciledItems = [];
                let totalVarianceCost = 0;
                let shrinkageCost = 0;
                for (const raw of items) {
                    const ingredientId = String(raw.ingredientId);
                    const actualStock = Number(raw.actualStock);
                    if (!mongoose_1.Types.ObjectId.isValid(ingredientId)) {
                        throw new Error(`Invalid ingredientId: ${ingredientId}`);
                    }
                    if (!Number.isFinite(actualStock) || actualStock < 0) {
                        throw new Error("actualStock must be a non-negative number");
                    }
                    const ingredient = await Supplier_1.Ingredient.findById(ingredientId).session(session);
                    if (!ingredient) {
                        throw new Error(`Ingredient not found: ${ingredientId}`);
                    }
                    const theoreticalStock = ingredient.currentStock;
                    const variance = round2(actualStock - theoreticalStock);
                    let varianceCost = 0;
                    if (variance < 0) {
                        const depletion = await depleteBatchesFIFO(ingredientId, -variance, session, { strict: false, fallbackUnitCost: ingredient.costPerUnit });
                        varianceCost = -depletion.costConsumed;
                        shrinkageCost += depletion.costConsumed;
                        await WasteLog_1.default.create([
                            {
                                ingredientId,
                                quantity: -variance,
                                unit: ingredient.unit,
                                costLost: depletion.costConsumed,
                                reason: "discrepancy",
                                loggedBy: actor.id,
                                batchBreakdown: depletion.breakdown,
                            },
                        ], { session });
                    }
                    else if (variance > 0) {
                        varianceCost = round2(variance * ingredient.costPerUnit);
                        await InventoryBatch_1.default.create([
                            {
                                ingredientId,
                                initialQuantity: variance,
                                remainingQuantity: variance,
                                unitCost: ingredient.costPerUnit,
                                expiryDate: new Date(Date.now() +
                                    ((_a = ingredient.shelfLife) !== null && _a !== void 0 ? _a : DEFAULT_SHELF_LIFE_DAYS) *
                                        MS_PER_DAY),
                                receivedAt: new Date(),
                            },
                        ], { session });
                    }
                    await Supplier_1.Ingredient.updateOne({ _id: ingredientId }, { $set: { currentStock: actualStock } }, { session });
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
                audit.auditDate = (_b = audit.auditDate) !== null && _b !== void 0 ? _b : new Date();
                await audit.save({ session });
                await (0, audit_1.writeAudit)({
                    userId: actor.id,
                    userRole: actor.role,
                    action: "SUBMIT_INVENTORY_AUDIT",
                    targetType: "InventoryAudit",
                    targetId: audit._id,
                    metadata: {
                        totalVarianceCost: round2(totalVarianceCost),
                        shrinkageCost: round2(shrinkageCost),
                        itemsReconciled: reconciledItems.length,
                    },
                }, session);
                result = {
                    auditId: safeId,
                    status: audit.status,
                    totalVarianceCost: round2(totalVarianceCost),
                    shrinkageCost: round2(shrinkageCost),
                    itemsReconciled: reconciledItems.length,
                };
            });
            if (!result)
                throw new Error("Failed to submit inventory audit");
            return result;
        }
        finally {
            await session.endSession();
        }
    }
}
exports.SubmitInventoryAuditUseCase = SubmitInventoryAuditUseCase;
class InventoryVarianceReportService {
    async getReport(windowDays = 30) {
        var _a, _b, _c, _d;
        const safeWindow = Number.isFinite(windowDays) && windowDays > 0
            ? Math.floor(windowDays)
            : 30;
        const cutoff = new Date(Date.now() - safeWindow * MS_PER_DAY);
        const [wasteAgg, topShrinking, recentAuditsRaw] = await Promise.all([
            WasteLog_1.default.aggregate([
                { $match: { reason: "discrepancy", createdAt: { $gte: cutoff } } },
                { $group: { _id: null, cost: { $sum: "$costLost" }, count: { $sum: 1 } } },
            ]),
            WasteLog_1.default.aggregate([
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
            InventoryAudit_1.default.find({ status: "submitted", auditDate: { $gte: cutoff } })
                .sort({ auditDate: -1 })
                .limit(20)
                .lean(),
        ]);
        const recentAudits = recentAuditsRaw.map((audit) => {
            var _a, _b;
            return ({
                auditId: String(audit._id),
                auditDate: audit.auditDate,
                auditedBy: audit.auditedBy,
                totalVarianceCost: round2(((_a = audit.items) !== null && _a !== void 0 ? _a : []).reduce((sum, item) => { var _a; return sum + ((_a = item.varianceCost) !== null && _a !== void 0 ? _a : 0); }, 0)),
                itemCount: ((_b = audit.items) !== null && _b !== void 0 ? _b : []).length,
            });
        });
        return {
            generatedAt: new Date(),
            windowDays: safeWindow,
            discrepancyWasteCost: round2((_b = (_a = wasteAgg[0]) === null || _a === void 0 ? void 0 : _a.cost) !== null && _b !== void 0 ? _b : 0),
            discrepancyEvents: (_d = (_c = wasteAgg[0]) === null || _c === void 0 ? void 0 : _c.count) !== null && _d !== void 0 ? _d : 0,
            recentAudits,
            topShrinkingIngredients: topShrinking.map((row) => ({
                ingredientId: row._id,
                totalQuantityLost: round2(row.totalQuantityLost),
                totalCostLost: round2(row.totalCostLost),
            })),
        };
    }
}
exports.InventoryVarianceReportService = InventoryVarianceReportService;
class CreateAuditDraftUseCase {
    async execute(actor) {
        const audit = await InventoryAudit_1.default.create({
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
exports.CreateAuditDraftUseCase = CreateAuditDraftUseCase;
class InventoryAuditQueryService {
    async getCountSheet() {
        const ingredients = await Supplier_1.Ingredient.find({ isActive: true })
            .select("name unit category currentStock costPerUnit isPrepped storageRequirement")
            .sort({ category: 1, name: 1 })
            .lean();
        return ingredients.map((ingredient) => {
            var _a, _b;
            return ({
                ingredientId: String(ingredient._id),
                name: ingredient.name,
                unit: ingredient.unit,
                category: ingredient.category,
                theoreticalStock: (_a = ingredient.currentStock) !== null && _a !== void 0 ? _a : 0,
                costPerUnit: (_b = ingredient.costPerUnit) !== null && _b !== void 0 ? _b : 0,
                isPrepped: Boolean(ingredient.isPrepped),
                storageRequirement: ingredient.storageRequirement,
            });
        });
    }
    async listAudits(limit = 50) {
        const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 50;
        const audits = await InventoryAudit_1.default.find()
            .sort({ auditDate: -1 })
            .limit(safeLimit)
            .lean();
        return audits.map((audit) => {
            var _a, _b;
            return ({
                auditId: String(audit._id),
                auditDate: audit.auditDate,
                auditedBy: audit.auditedBy,
                status: audit.status,
                itemCount: ((_a = audit.items) !== null && _a !== void 0 ? _a : []).length,
                totalVarianceCost: round2(((_b = audit.items) !== null && _b !== void 0 ? _b : []).reduce((sum, item) => { var _a; return sum + ((_a = item.varianceCost) !== null && _a !== void 0 ? _a : 0); }, 0)),
            });
        });
    }
    async getAudit(auditId) {
        const safeId = String(auditId);
        if (!mongoose_1.Types.ObjectId.isValid(safeId)) {
            throw new Error("Invalid auditId");
        }
        const audit = await InventoryAudit_1.default.findById(safeId).lean();
        if (!audit)
            throw new Error("Inventory audit not found");
        return audit;
    }
}
exports.InventoryAuditQueryService = InventoryAuditQueryService;
exports.receivePurchaseOrderUseCase = new ReceivePurchaseOrderUseCase();
exports.prepIngredientUseCase = new PrepIngredientUseCase();
exports.submitInventoryAuditUseCase = new SubmitInventoryAuditUseCase();
exports.createAuditDraftUseCase = new CreateAuditDraftUseCase();
exports.inventoryAuditQueryService = new InventoryAuditQueryService();
exports.inventoryVarianceReportService = new InventoryVarianceReportService();
//# sourceMappingURL=inventory_management_service.js.map