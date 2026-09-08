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
const resolvedConflictSchema = new mongoose_1.Schema({
    entity: { type: String, enum: ["table", "order"], required: true },
    targetId: { type: String, required: true },
    clientTimestamp: { type: Date, required: true },
    serverTimestamp: { type: Date, required: true },
    resolution: {
        type: String,
        enum: ["client_applied", "server_kept", "merged"],
        required: true,
    },
    mergedFields: { type: [String], default: [] },
}, { _id: false });
const syncLogSchema = new mongoose_1.Schema({
    deviceId: { type: String, required: true, trim: true, index: true },
    syncTimestamp: { type: Date, default: Date.now, index: true },
    appliedCount: { type: Number, default: 0, min: 0 },
    conflictsResolved: { type: [resolvedConflictSchema], default: [] },
}, { timestamps: true });
exports.default = mongoose_1.default.model("SyncLog", syncLogSchema);
//# sourceMappingURL=SyncLog.js.map