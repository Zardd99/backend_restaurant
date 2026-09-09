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
exports.kdsPacingService = exports.KdsPacingService = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const KdsTicket_1 = __importDefault(require("../models/KdsTicket"));
const audit_1 = require("./audit");
const MS_PER_MINUTE = 60000;
class KdsPacingService {
    async paveTicket(orderId, items, actor) {
        if (!mongoose_1.Types.ObjectId.isValid(String(orderId))) {
            throw new Error("Invalid orderId");
        }
        if (!Array.isArray(items) || items.length === 0) {
            throw new Error("A ticket requires at least one item");
        }
        const now = Date.now();
        const maxCookTime = items.reduce((max, item) => Math.max(max, Math.max(0, item.cookTimeMinutes)), 0);
        const stationItems = items.map((item) => {
            const cookTime = Math.max(0, item.cookTimeMinutes);
            const delayMinutes = maxCookTime - cookTime;
            const fireImmediately = delayMinutes <= 0;
            return {
                itemId: new mongoose_1.Types.ObjectId(String(item.itemId)),
                name: item.name,
                station: item.station,
                cookTimeMinutes: cookTime,
                pacingStatus: fireImmediately ? "fired" : "hold",
                targetFireTime: new Date(now + delayMinutes * MS_PER_MINUTE),
                expoAlertSent: false,
            };
        });
        const hasFiredItem = stationItems.some((item) => item.pacingStatus === "fired");
        const session = await mongoose_1.default.startSession();
        try {
            let created = null;
            await session.withTransaction(async () => {
                const [ticket] = await KdsTicket_1.default.create([
                    {
                        orderId: new mongoose_1.Types.ObjectId(String(orderId)),
                        ticketStatus: hasFiredItem ? "active" : "pending",
                        stationItems,
                    },
                ], { session });
                created = ticket;
                if (actor) {
                    await (0, audit_1.writeAudit)({
                        userId: actor.id,
                        userRole: actor.role,
                        action: "PAVE_KDS_TICKET",
                        targetType: "KdsTicket",
                        targetId: ticket._id,
                        metadata: { orderId: String(orderId), maxCookTime },
                    }, session);
                }
            });
            if (!created)
                throw new Error("Failed to create KDS ticket");
            return created;
        }
        finally {
            await session.endSession();
        }
    }
    async checkAndFirePacedItems(now = new Date()) {
        const fired = await KdsTicket_1.default.updateMany({
            "stationItems.pacingStatus": "hold",
            "stationItems.targetFireTime": { $lte: now },
        }, { $set: { "stationItems.$[due].pacingStatus": "fired" } }, {
            arrayFilters: [
                { "due.pacingStatus": "hold", "due.targetFireTime": { $lte: now } },
            ],
        });
        await KdsTicket_1.default.updateMany({ ticketStatus: "pending", "stationItems.pacingStatus": "fired" }, { $set: { ticketStatus: "active" } });
        return fired.modifiedCount;
    }
    async expediteTicket(ticketId, actor) {
        if (!mongoose_1.Types.ObjectId.isValid(String(ticketId))) {
            throw new Error("Invalid ticketId");
        }
        const session = await mongoose_1.default.startSession();
        try {
            let updated = null;
            await session.withTransaction(async () => {
                const now = new Date();
                updated = await KdsTicket_1.default.findOneAndUpdate({ _id: ticketId }, {
                    $set: {
                        ticketStatus: "expedited",
                        "stationItems.$[held].pacingStatus": "fired",
                        "stationItems.$[held].targetFireTime": now,
                    },
                }, {
                    arrayFilters: [{ "held.pacingStatus": "hold" }],
                    new: true,
                    session,
                });
                if (!updated)
                    throw new Error("KDS ticket not found");
                await (0, audit_1.writeAudit)({
                    userId: actor.id,
                    userRole: actor.role,
                    action: "EXPEDITE_KDS_TICKET",
                    targetType: "KdsTicket",
                    targetId: new mongoose_1.Types.ObjectId(String(ticketId)),
                }, session);
            });
            if (!updated)
                throw new Error("KDS ticket not found");
            return updated;
        }
        finally {
            await session.endSession();
        }
    }
    async markItemCompleted(ticketId, itemId, actor) {
        if (!mongoose_1.Types.ObjectId.isValid(String(ticketId)) ||
            !mongoose_1.Types.ObjectId.isValid(String(itemId))) {
            throw new Error("Invalid ticketId or itemId");
        }
        const session = await mongoose_1.default.startSession();
        try {
            let updated = null;
            await session.withTransaction(async () => {
                updated = await KdsTicket_1.default.findOneAndUpdate({ _id: ticketId, "stationItems.itemId": itemId }, { $set: { "stationItems.$.pacingStatus": "completed" } }, { new: true, session });
                if (!updated)
                    throw new Error("KDS ticket or item not found");
                const allCompleted = updated.stationItems.every((item) => item.pacingStatus === "completed");
                if (allCompleted) {
                    updated = await KdsTicket_1.default.findOneAndUpdate({ _id: ticketId }, { $set: { ticketStatus: "completed" } }, { new: true, session });
                }
                await (0, audit_1.writeAudit)({
                    userId: actor.id,
                    userRole: actor.role,
                    action: "COMPLETE_KDS_ITEM",
                    targetType: "KdsTicket",
                    targetId: new mongoose_1.Types.ObjectId(String(ticketId)),
                    metadata: { itemId: String(itemId) },
                }, session);
            });
            if (!updated)
                throw new Error("KDS ticket or item not found");
            return updated;
        }
        finally {
            await session.endSession();
        }
    }
}
exports.KdsPacingService = KdsPacingService;
exports.kdsPacingService = new KdsPacingService();
//# sourceMappingURL=KdsPacingService.js.map