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
exports.KDS_STATIONS = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.KDS_STATIONS = [
    "grill",
    "fry",
    "prep",
    "expo",
    "pantry",
];
const kdsStationItemSchema = new mongoose_1.Schema({
    itemId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true },
    station: {
        type: String,
        enum: exports.KDS_STATIONS,
        required: true,
    },
    cookTimeMinutes: { type: Number, required: true, min: 0 },
    pacingStatus: {
        type: String,
        enum: ["hold", "fired", "completed"],
        default: "hold",
    },
    targetFireTime: { type: Date, required: true },
    expoAlertSent: { type: Boolean, default: false },
}, { _id: false });
const kdsTicketSchema = new mongoose_1.Schema({
    orderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Order",
        required: true,
        unique: true,
        index: true,
    },
    ticketStatus: {
        type: String,
        enum: ["pending", "active", "completed", "expedited"],
        default: "pending",
        index: true,
    },
    stationItems: { type: [kdsStationItemSchema], default: [] },
}, { timestamps: true });
kdsTicketSchema.index({
    "stationItems.pacingStatus": 1,
    "stationItems.targetFireTime": 1,
});
exports.default = mongoose_1.default.model("KdsTicket", kdsTicketSchema);
//# sourceMappingURL=KdsTicket.js.map