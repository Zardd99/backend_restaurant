import { ClientSession, Types } from "mongoose";
import AuditLog, { AuditAction, AuditTargetType } from "../models/AuditLog";

export interface AuditInput {
  userId: Types.ObjectId | string;
  userRole: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: Types.ObjectId | string;
  reason?: string;
  diff?: { before: unknown; after: unknown };
  metadata?: Record<string, unknown>;
}

/**
 * Append an immutable audit entry. Pass a session to enroll the write in the
 * caller's transaction so the audit row commits atomically with the change.
 */
export async function writeAudit(
  input: AuditInput,
  session?: ClientSession,
): Promise<void> {
  await AuditLog.create(
    [
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
    ],
    { session },
  );
}
