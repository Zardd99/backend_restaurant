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
exports.WASTE_REASONS = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.WASTE_REASONS = [
    "spoilage",
    "dropped",
    "comp",
    "kitchen_error",
    "discrepancy",
];
const wasteBatchConsumptionSchema = new mongoose_1.Schema({
    batchId: { type: mongoose_1.Schema.Types.ObjectId, ref: "InventoryBatch", required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
}, { _id: false });
const wasteLogSchema = new mongoose_1.Schema({
    ingredientId: { type: String, required: true, trim: true, index: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true },
    costLost: { type: Number, required: true, min: 0 },
    reason: {
        type: String,
        enum: exports.WASTE_REASONS,
        required: true,
        index: true,
    },
    loggedBy: { type: String, required: true },
    batchBreakdown: { type: [wasteBatchConsumptionSchema], default: [] },
}, { timestamps: true });
wasteLogSchema.pre(/^(updateOne|updateMany|findOneAndUpdate|deleteOne|deleteMany|findOneAndDelete)$/, function (next) {
    next(new Error("Waste logs are immutable and cannot be modified or deleted"));
});
exports.default = mongoose_1.default.model("WasteLog", wasteLogSchema);
//# sourceMappingURL=WasteLog.js.map