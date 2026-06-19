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
const prepStepSchema = new mongoose_1.Schema({
    stepName: {
        type: String,
        required: true,
        enum: ["ingredient_prep", "cooking", "plating", "quality_check", "custom"],
    },
    description: { type: String },
    estimatedDurationMinutes: { type: Number, required: true, min: 1 },
    status: {
        type: String,
        enum: ["pending", "in-progress", "completed", "skipped", "failed"],
        default: "pending",
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
    timeoutAt: { type: Date },
    notes: { type: String },
});
const chefPrepProgressSchema = new mongoose_1.Schema({
    orderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Order",
        required: true,
        index: true,
    },
    chefId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    chefName: { type: String },
    steps: [prepStepSchema],
    overallStatus: {
        type: String,
        enum: ["pending", "in-progress", "completed", "cancelled"],
        default: "pending",
        index: true,
    },
    totalEstimatedMinutes: { type: Number, required: true, min: 1 },
    startedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String },
}, {
    timestamps: true,
});
chefPrepProgressSchema.index({ orderId: 1, overallStatus: 1 });
chefPrepProgressSchema.index({ createdAt: 1 });
exports.default = mongoose_1.default.model("ChefPrepProgress", chefPrepProgressSchema);
//# sourceMappingURL=ChefPrepProgress.js.map