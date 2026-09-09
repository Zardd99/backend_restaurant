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
exports.clientSyncService = exports.ClientSyncService = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const Table_1 = __importDefault(require("../models/Table"));
const Order_1 = __importDefault(require("../models/Order"));
const SyncLog_1 = __importDefault(require("../models/SyncLog"));
const TABLE_WRITABLE_FIELDS = [
    "status",
    "currentGuestCount",
    "currentOrderId",
    "reservationTime",
];
const ORDER_WRITABLE_FIELDS = ["status", "tableNumber"];
const TABLE_STATUSES = ["vacant", "occupied", "reserved", "dirty"];
const ORDER_STATUSES = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "served",
    "cancelled",
];
function toDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error("Invalid clientTimestamp");
    }
    return date;
}
class ClientSyncService {
    async processOfflineSync(deviceId, queuedTransactions) {
        const safeDeviceId = String(deviceId).trim();
        if (!safeDeviceId)
            throw new Error("deviceId is required");
        if (!Array.isArray(queuedTransactions)) {
            throw new Error("queuedTransactions must be an array");
        }
        const conflicts = [];
        const results = [];
        let appliedCount = 0;
        for (const tx of queuedTransactions) {
            try {
                const result = await this.reconcileOne(tx, conflicts);
                if (result.status === "applied" || result.status === "merged") {
                    appliedCount += 1;
                }
                results.push(result);
            }
            catch (error) {
                results.push({
                    targetId: String(tx === null || tx === void 0 ? void 0 : tx.targetId),
                    entity: tx === null || tx === void 0 ? void 0 : tx.entity,
                    status: "rejected",
                    message: error.message,
                });
            }
        }
        const [syncLog] = await SyncLog_1.default.create([
            {
                deviceId: safeDeviceId,
                syncTimestamp: new Date(),
                appliedCount,
                conflictsResolved: conflicts,
            },
        ]);
        return {
            syncLogId: String(syncLog._id),
            deviceId: safeDeviceId,
            appliedCount,
            conflicts,
            results,
        };
    }
    async reconcileOne(tx, conflicts) {
        if (!tx || (tx.entity !== "table" && tx.entity !== "order")) {
            throw new Error("Unsupported sync entity");
        }
        if (!mongoose_1.Types.ObjectId.isValid(String(tx.targetId))) {
            throw new Error("Invalid targetId");
        }
        const clientTimestamp = toDate(tx.clientTimestamp);
        return tx.entity === "table"
            ? this.reconcileTable(tx, clientTimestamp)
            : this.reconcileOrder(tx, clientTimestamp, conflicts);
    }
    async reconcileTable(tx, clientTimestamp) {
        const session = await mongoose_1.default.startSession();
        try {
            let outcome = {
                targetId: tx.targetId,
                entity: "table",
                status: "server_kept",
            };
            await session.withTransaction(async () => {
                const table = await Table_1.default.findById(tx.targetId).session(session);
                if (!table)
                    throw new Error("Table not found");
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
        }
        finally {
            await session.endSession();
        }
    }
    buildTableUpdate(payload) {
        const update = {};
        for (const field of TABLE_WRITABLE_FIELDS) {
            if (!(field in payload))
                continue;
            const value = payload[field];
            if (field === "status") {
                const status = String(value);
                if (!TABLE_STATUSES.includes(status)) {
                    throw new Error(`Invalid table status: ${status}`);
                }
                update.status = status;
            }
            else if (field === "currentGuestCount") {
                const count = Number(value);
                if (!Number.isFinite(count) || count < 0) {
                    throw new Error("currentGuestCount must be a non-negative number");
                }
                update.currentGuestCount = count;
            }
            else if (field === "currentOrderId") {
                if (value === null) {
                    update.currentOrderId = null;
                }
                else if (mongoose_1.Types.ObjectId.isValid(String(value))) {
                    update.currentOrderId = new mongoose_1.Types.ObjectId(String(value));
                }
                else {
                    throw new Error("Invalid currentOrderId");
                }
            }
            else if (field === "reservationTime") {
                update.reservationTime = value === null ? null : toDate(value);
            }
        }
        return update;
    }
    async reconcileOrder(tx, clientTimestamp, conflicts) {
        const session = await mongoose_1.default.startSession();
        try {
            let outcome = {
                targetId: tx.targetId,
                entity: "order",
                status: "server_kept",
            };
            await session.withTransaction(async () => {
                const order = await Order_1.default.findById(tx.targetId).session(session);
                if (!order)
                    throw new Error("Order not found");
                const serverTimestamp = order.updatedAt;
                if (serverTimestamp.getTime() > clientTimestamp.getTime()) {
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
                    }
                    else {
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
                if (Object.keys(update).length > 0)
                    order.set(update);
                await order.save({ session });
                outcome = { targetId: tx.targetId, entity: "order", status: "applied" };
            });
            return outcome;
        }
        finally {
            await session.endSession();
        }
    }
    buildOrderUpdate(payload) {
        const update = {};
        for (const field of ORDER_WRITABLE_FIELDS) {
            if (!(field in payload))
                continue;
            const value = payload[field];
            if (field === "status") {
                const status = String(value);
                if (!ORDER_STATUSES.includes(status)) {
                    throw new Error(`Invalid order status: ${status}`);
                }
                update.status = status;
            }
            else if (field === "tableNumber") {
                const tableNumber = Number(value);
                if (!Number.isFinite(tableNumber) || tableNumber < 1) {
                    throw new Error("tableNumber must be a positive number");
                }
                update.tableNumber = tableNumber;
            }
        }
        return update;
    }
    mergeAddedOrderItems(order, payload) {
        const incoming = payload.items;
        if (!Array.isArray(incoming) || incoming.length === 0)
            return [];
        const existingIds = new Set(order.items
            .map((item) => item._id)
            .filter((id) => Boolean(id))
            .map((id) => String(id)));
        let added = 0;
        for (const raw of incoming) {
            if (!raw || typeof raw !== "object")
                continue;
            const candidate = raw;
            const candidateId = candidate._id ? String(candidate._id) : undefined;
            if (candidateId && existingIds.has(candidateId))
                continue;
            if (!mongoose_1.Types.ObjectId.isValid(String(candidate.menuItem)))
                continue;
            const quantity = Number(candidate.quantity);
            const price = Number(candidate.price);
            if (!Number.isFinite(quantity) || quantity < 1)
                continue;
            if (!Number.isFinite(price) || price < 0)
                continue;
            order.items.push({
                menuItem: new mongoose_1.Types.ObjectId(String(candidate.menuItem)),
                quantity,
                price,
                specialInstructions: typeof candidate.specialInstructions === "string"
                    ? candidate.specialInstructions
                    : undefined,
                status: "pending",
            });
            added += 1;
        }
        if (added === 0)
            return [];
        order.totalAmount = order.items.reduce((sum, item) => { var _a; return sum + ((_a = item.finalPrice) !== null && _a !== void 0 ? _a : item.price) * item.quantity; }, 0);
        return ["items", "totalAmount"];
    }
}
exports.ClientSyncService = ClientSyncService;
exports.clientSyncService = new ClientSyncService();
//# sourceMappingURL=ClientSyncService.js.map