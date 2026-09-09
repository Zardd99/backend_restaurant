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
exports.TABLE_STATUSES = exports.TABLE_SECTIONS = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.TABLE_SECTIONS = ["indoor", "patio", "bar", "vip"];
exports.TABLE_STATUSES = [
    "vacant",
    "occupied",
    "reserved",
    "dirty",
];
const tableSchema = new mongoose_1.Schema({
    tableNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
    },
    capacity: { type: Number, required: true, min: 1 },
    section: {
        type: String,
        enum: exports.TABLE_SECTIONS,
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: exports.TABLE_STATUSES,
        default: "vacant",
        index: true,
    },
    currentOrderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Order",
        default: null,
    },
    currentGuestCount: { type: Number, default: 0, min: 0 },
    joinedWith: { type: [String], default: [] },
    reservationTime: { type: Date, default: null },
    vacantSince: { type: Date, default: Date.now },
}, { timestamps: true });
tableSchema.index({ section: 1, status: 1, capacity: 1, vacantSince: 1 });
exports.default = mongoose_1.default.model("Table", tableSchema);
//# sourceMappingURL=Table.js.map