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
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const auditLogSchema = new mongoose_1.Schema({
    timestamp: { type: Date, default: Date.now, index: true },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    userRole: { type: String, required: true },
    action: {
        type: String,
        enum: [
            "VOID_ORDER",
            "VOID_ITEM",
            "COMP_ORDER",
            "APPLY_DISCOUNT",
            "MODIFY_ORDER",
            "TRANSFER_TABLE",
            "MERGE_TABLES",
            "PROCESS_PAYMENT",
            "REFUND",
            "TOGGLE_86",
            "OPEN_SHIFT",
            "CLOSE_SHIFT",
            "AUTO_ASSIGN_TABLE",
            "SEAT_GUESTS",
            "CHECKOUT_TABLE",
            "BUS_TABLE",
            "JOIN_TABLES",
            "SPLIT_TABLES",
            "PAVE_KDS_TICKET",
            "EXPEDITE_KDS_TICKET",
            "COMPLETE_KDS_ITEM",
            "RECEIVE_INVENTORY",
            "LOG_WASTE",
            "RECEIVE_PURCHASE_ORDER",
            "PREP_INGREDIENT",
            "SUBMIT_INVENTORY_AUDIT",
        ],
        required: true,
        index: true,
    },
    targetType: {
        type: String,
        enum: [
            "Order",
            "OrderItem",
            "MenuItem",
            "Table",
            "TableReservation",
            "Shift",
            "KdsTicket",
            "InventoryBatch",
            "WasteLog",
            "PurchaseOrder",
            "Ingredient",
            "InventoryAudit",
        ],
        required: true,
    },
    targetId: { type: mongoose_1.Schema.Types.ObjectId, required: true, index: true },
    reason: { type: String, maxlength: 500 },
    diff: {
        before: mongoose_1.Schema.Types.Mixed,
        after: mongoose_1.Schema.Types.Mixed,
    },
    metadata: mongoose_1.Schema.Types.Mixed,
}, { timestamps: true });
auditLogSchema.pre(/^(updateOne|updateMany|findOneAndUpdate|deleteOne|deleteMany|findOneAndDelete)$/, function (next) {
    next(new Error("Audit logs are immutable and cannot be modified or deleted"));
});
exports.default = mongoose_1.default.model("AuditLog", auditLogSchema);
//# sourceMappingURL=AuditLog.js.map