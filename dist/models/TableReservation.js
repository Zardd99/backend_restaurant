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
exports.RESERVATION_STATUSES = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.RESERVATION_STATUSES = [
    "pending",
    "seated",
    "cancelled",
    "no_show",
];
const tableReservationSchema = new mongoose_1.Schema({
    guestName: { type: String, required: true, trim: true },
    partySize: { type: Number, required: true, min: 1 },
    reservedFor: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, default: 120, min: 1 },
    tableId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Table",
        default: null,
        index: true,
    },
    status: {
        type: String,
        enum: exports.RESERVATION_STATUSES,
        default: "pending",
        index: true,
    },
}, { timestamps: true });
tableReservationSchema.index({ tableId: 1, status: 1, reservedFor: 1 });
exports.default = mongoose_1.default.model("TableReservation", tableReservationSchema);
//# sourceMappingURL=TableReservation.js.map