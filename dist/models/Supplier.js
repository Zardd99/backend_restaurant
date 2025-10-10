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
exports.LowStockNotification = exports.StockAdjustment = exports.PurchaseOrder = exports.Ingredient = exports.Supplier = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const supplierSchema = new mongoose_1.Schema({
    name: { type: String, required: true, unique: true },
    contactPerson: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zipCode: { type: String, required: true },
        country: { type: String, required: true },
    },
    suppliedIngredients: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "Ingredient" }],
    paymentTerms: { type: String, default: "Net 30" },
    isActive: { type: Boolean, default: true },
    notes: { type: String },
}, {
    timestamps: true,
});
const ingredientSchema = new mongoose_1.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    unit: { type: String, required: true },
    currentStock: { type: Number, default: 0 },
    minStock: { type: Number, required: true },
    costPerUnit: { type: Number, required: true },
    supplier: { type: mongoose_1.Schema.Types.ObjectId, ref: "Supplier", required: true },
    category: { type: String, required: true },
    shelfLife: { type: Number },
    isActive: { type: Boolean, default: true },
}, {
    timestamps: true,
});
const purchaseOrderSchema = new mongoose_1.Schema({
    orderNumber: { type: String, required: true },
    supplier: { type: mongoose_1.Schema.Types.ObjectId, ref: "Supplier", required: true },
    items: [
        {
            ingredient: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: "Ingredient",
                required: true,
            },
            quantity: { type: Number, required: true },
            unitCost: { type: Number, required: true },
            totalCost: { type: Number, required: true },
        },
    ],
    totalAmount: { type: Number, required: true },
    orderDate: { type: Date, default: Date.now },
    expectedDelivery: { type: Date, required: true },
    actualDelivery: { type: Date },
    status: {
        type: String,
        enum: ["pending", "approved", "ordered", "delivered", "cancelled"],
        default: "pending",
    },
    notes: { type: String },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
}, {
    timestamps: true,
});
const stockAdjustmentSchema = new mongoose_1.Schema({
    ingredient: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Ingredient",
        required: true,
    },
    adjustmentType: {
        type: String,
        enum: ["add", "remove", "set"],
        required: true,
    },
    quantity: { type: Number, required: true },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    reason: { type: String, required: true },
    adjustedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String },
}, {
    timestamps: true,
});
const lowStockNotificationSchema = new mongoose_1.Schema({
    ingredient: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Ingredient",
        required: true,
    },
    currentStock: { type: Number, required: true },
    minStock: { type: Number, required: true },
    notifiedAt: { type: Date, default: Date.now },
    acknowledged: { type: Boolean, default: false },
    acknowledgedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    acknowledgedAt: { type: Date },
}, {
    timestamps: true,
});
ingredientSchema.index({ currentStock: 1, minStock: 1 });
ingredientSchema.index({ supplier: 1 });
purchaseOrderSchema.index({ supplier: 1, status: 1 });
purchaseOrderSchema.index({ orderNumber: 1 });
lowStockNotificationSchema.index({ acknowledged: 1, ingredient: 1 });
exports.Supplier = mongoose_1.default.model("Supplier", supplierSchema);
exports.Ingredient = mongoose_1.default.model("Ingredient", ingredientSchema);
exports.PurchaseOrder = mongoose_1.default.model("PurchaseOrder", purchaseOrderSchema);
exports.StockAdjustment = mongoose_1.default.model("StockAdjustment", stockAdjustmentSchema);
exports.LowStockNotification = mongoose_1.default.model("LowStockNotification", lowStockNotificationSchema);
//# sourceMappingURL=Supplier.js.map