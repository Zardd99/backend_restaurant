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
const inventoryAuditItemSchema = new mongoose_1.Schema({
    ingredientId: { type: String, required: true, trim: true },
    theoreticalStock: { type: Number, required: true },
    actualStock: { type: Number, required: true, min: 0 },
    variance: { type: Number, required: true },
    varianceCost: { type: Number, required: true },
}, { _id: false });
const inventoryAuditSchema = new mongoose_1.Schema({
    auditDate: { type: Date, default: Date.now, index: true },
    auditedBy: { type: String, required: true },
    status: {
        type: String,
        enum: ["draft", "submitted"],
        default: "draft",
        index: true,
    },
    items: { type: [inventoryAuditItemSchema], default: [] },
}, { timestamps: true });
exports.default = mongoose_1.default.model("InventoryAudit", inventoryAuditSchema);
//# sourceMappingURL=InventoryAudit.js.map