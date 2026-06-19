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
const orderItemSchema = new mongoose_1.Schema({
    menuItem: { type: mongoose_1.Schema.Types.ObjectId, ref: "MenuItem", required: true },
    quantity: { type: Number, required: true, min: 1 },
    specialInstructions: { type: String, maxlength: 200 },
    price: { type: Number, required: true },
    originalPrice: { type: Number },
    discountAmount: { type: Number, default: 0 },
    finalPrice: { type: Number },
    appliedPromotion: { type: mongoose_1.Schema.Types.ObjectId, ref: "Promotion" },
});
const orderSchema = new mongoose_1.Schema({
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true },
    totalDiscountAmount: { type: Number, default: 0 },
    status: {
        type: String,
        enum: [
            "pending",
            "confirmed",
            "preparing",
            "ready",
            "served",
            "cancelled",
        ],
        default: "pending",
        index: true,
    },
    customerName: { type: String },
    tableNumber: { type: Number, min: 1, index: true },
    orderType: {
        type: String,
        enum: ["dine-in", "takeaway", "delivery"],
        required: true,
    },
    orderDate: { type: Date, default: Date.now },
    inventoryDeduction: {
        status: {
            type: String,
            enum: ["pending", "completed", "failed", "skipped"],
            default: "pending",
        },
        data: mongoose_1.default.Schema.Types.Mixed,
        warning: String,
        timestamp: Date,
        lastUpdated: Date,
    },
    totalPrepTimeoutMinutes: {
        type: Number,
        default: 30,
        min: 1,
    },
    prepStartedAt: { type: Date, index: true },
    prepTimeoutAt: { type: Date, index: true },
    lastPrepUpdateAt: { type: Date },
    autoCancel: { type: Boolean, default: true },
    cancelledReason: { type: String },
}, {
    timestamps: true,
});
orderSchema.index({ tableNumber: 1 }, {
    unique: true,
    sparse: true,
    partialFilterExpression: {
        tableNumber: { $exists: true, $ne: null },
        status: { $in: ["pending", "confirmed", "preparing", "ready"] },
    },
});
exports.default = mongoose_1.default.model("Order", orderSchema);
//# sourceMappingURL=Order.js.map