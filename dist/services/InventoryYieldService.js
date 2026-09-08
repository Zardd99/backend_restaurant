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
exports.inventoryYieldService = exports.InventoryYieldService = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const InventoryBatch_1 = __importDefault(require("../models/InventoryBatch"));
const WasteLog_1 = __importStar(require("../models/WasteLog"));
const Supplier_1 = require("../models/Supplier");
const audit_1 = require("./audit");
const round2 = (value) => Math.round(value * 100) / 100;
class InventoryYieldService {
    async receiveBatch(input, actor) {
        const ingredientId = String(input.ingredientId).trim();
        const quantity = Number(input.quantity);
        const unitCost = Number(input.unitCost);
        const expiryDate = new Date(input.expiryDate);
        if (!ingredientId)
            throw new Error("ingredientId is required");
        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error("quantity must be a positive number");
        }
        if (!Number.isFinite(unitCost) || unitCost < 0) {
            throw new Error("unitCost must be a non-negative number");
        }
        if (Number.isNaN(expiryDate.getTime())) {
            throw new Error("expiryDate must be a valid date");
        }
        const session = await mongoose_1.default.startSession();
        try {
            await session.withTransaction(async () => {
                const [batch] = await InventoryBatch_1.default.create([
                    {
                        ingredientId,
                        initialQuantity: quantity,
                        remainingQuantity: quantity,
                        unitCost,
                        expiryDate,
                        receivedAt: new Date(),
                    },
                ], { session });
                if (mongoose_1.Types.ObjectId.isValid(ingredientId)) {
                    await Supplier_1.Ingredient.updateOne({ _id: ingredientId }, { $inc: { currentStock: quantity }, $set: { lastRestocked: new Date() } }, { session });
                }
                await (0, audit_1.writeAudit)({
                    userId: actor.id,
                    userRole: actor.role,
                    action: "RECEIVE_INVENTORY",
                    targetType: "InventoryBatch",
                    targetId: batch._id,
                    metadata: { ingredientId, quantity, unitCost },
                }, session);
            });
        }
        finally {
            await session.endSession();
        }
    }
    async logWaste(ingredientId, quantity, reason, userId, unit) {
        const safeIngredientId = String(ingredientId).trim();
        const safeQuantity = Number(quantity);
        const safeUnit = String(unit).trim();
        if (!safeIngredientId)
            throw new Error("ingredientId is required");
        if (!Number.isFinite(safeQuantity) || safeQuantity <= 0) {
            throw new Error("quantity must be a positive number");
        }
        if (!safeUnit)
            throw new Error("unit is required");
        if (!WasteLog_1.WASTE_REASONS.includes(reason)) {
            throw new Error("Invalid waste reason");
        }
        const session = await mongoose_1.default.startSession();
        try {
            let wasteLog = null;
            await session.withTransaction(async () => {
                const now = new Date();
                const batches = await InventoryBatch_1.default.find({
                    ingredientId: safeIngredientId,
                    remainingQuantity: { $gt: 0 },
                    expiryDate: { $gte: now },
                })
                    .sort({ receivedAt: 1, createdAt: 1 })
                    .session(session);
                let outstanding = safeQuantity;
                let costLost = 0;
                const breakdown = [];
                for (const batch of batches) {
                    if (outstanding <= 0)
                        break;
                    const take = Math.min(outstanding, batch.remainingQuantity);
                    const result = await InventoryBatch_1.default.updateOne({ _id: batch._id, remainingQuantity: { $gte: take } }, { $inc: { remainingQuantity: -take } }, { session });
                    if (result.modifiedCount !== 1) {
                        throw new Error(`BATCH_CONTENTION:${String(batch._id)} — retry waste log`);
                    }
                    costLost += take * batch.unitCost;
                    breakdown.push({
                        batchId: batch._id,
                        quantity: take,
                        unitCost: batch.unitCost,
                    });
                    outstanding -= take;
                }
                if (outstanding > 0) {
                    throw new Error(`INSUFFICIENT_BATCH_STOCK:${safeIngredientId}`);
                }
                if (mongoose_1.Types.ObjectId.isValid(safeIngredientId)) {
                    await Supplier_1.Ingredient.updateOne({ _id: safeIngredientId }, { $inc: { currentStock: -safeQuantity } }, { session });
                }
                const [created] = await WasteLog_1.default.create([
                    {
                        ingredientId: safeIngredientId,
                        quantity: safeQuantity,
                        unit: safeUnit,
                        costLost: round2(costLost),
                        reason,
                        loggedBy: userId,
                        batchBreakdown: breakdown,
                    },
                ], { session });
                wasteLog = created;
                await (0, audit_1.writeAudit)({
                    userId,
                    userRole: "system",
                    action: "LOG_WASTE",
                    targetType: "WasteLog",
                    targetId: created._id,
                    reason,
                    metadata: {
                        ingredientId: safeIngredientId,
                        quantity: safeQuantity,
                        costLost: round2(costLost),
                    },
                }, session);
            });
            if (!wasteLog)
                throw new Error("Failed to write waste log");
            return wasteLog;
        }
        finally {
            await session.endSession();
        }
    }
    async calculateRealCOGS(startDate, endDate) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            throw new Error("startDate and endDate must be valid dates");
        }
        if (start > end) {
            throw new Error("startDate must not be after endDate");
        }
        const [beginningAgg, purchasesAgg, endingAgg, wasteAgg] = await Promise.all([
            InventoryBatch_1.default.aggregate([
                { $match: { receivedAt: { $lt: start } } },
                {
                    $group: {
                        _id: null,
                        cost: { $sum: { $multiply: ["$initialQuantity", "$unitCost"] } },
                    },
                },
            ]),
            InventoryBatch_1.default.aggregate([
                { $match: { receivedAt: { $gte: start, $lte: end } } },
                {
                    $group: {
                        _id: null,
                        cost: { $sum: { $multiply: ["$initialQuantity", "$unitCost"] } },
                    },
                },
            ]),
            InventoryBatch_1.default.aggregate([
                {
                    $group: {
                        _id: null,
                        cost: { $sum: { $multiply: ["$remainingQuantity", "$unitCost"] } },
                    },
                },
            ]),
            WasteLog_1.default.aggregate([
                { $match: { createdAt: { $gte: start, $lte: end } } },
                { $group: { _id: null, cost: { $sum: "$costLost" } } },
            ]),
        ]);
        const beginningInventoryCost = round2((_b = (_a = beginningAgg[0]) === null || _a === void 0 ? void 0 : _a.cost) !== null && _b !== void 0 ? _b : 0);
        const purchasesCost = round2((_d = (_c = purchasesAgg[0]) === null || _c === void 0 ? void 0 : _c.cost) !== null && _d !== void 0 ? _d : 0);
        const endingInventoryCost = round2((_f = (_e = endingAgg[0]) === null || _e === void 0 ? void 0 : _e.cost) !== null && _f !== void 0 ? _f : 0);
        const wasteCost = round2((_h = (_g = wasteAgg[0]) === null || _g === void 0 ? void 0 : _g.cost) !== null && _h !== void 0 ? _h : 0);
        const cogs = round2(beginningInventoryCost + purchasesCost - endingInventoryCost - wasteCost);
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
exports.InventoryYieldService = InventoryYieldService;
exports.inventoryYieldService = new InventoryYieldService();
//# sourceMappingURL=InventoryYieldService.js.map