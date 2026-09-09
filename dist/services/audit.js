"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAudit = writeAudit;
const AuditLog_1 = __importDefault(require("../models/AuditLog"));
async function writeAudit(input, session) {
    await AuditLog_1.default.create([
        {
            timestamp: new Date(),
            userId: input.userId,
            userRole: input.userRole,
            action: input.action,
            targetType: input.targetType,
            targetId: input.targetId,
            reason: input.reason,
            diff: input.diff,
            metadata: input.metadata,
        },
    ], { session });
}
//# sourceMappingURL=audit.js.map