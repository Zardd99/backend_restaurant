import mongoose, { Types } from "mongoose";
import Order, { IOrderItem, ISplitPayment } from "../models/Order";
import MenuItem from "../models/MenuItem";
import User from "../models/User";
import Receipt from "../models/Receipt";
import Shift, { IZReport } from "../models/Shift";
import { writeAudit } from "./audit";
import { applyInventoryDelta } from "./inventory-adjustment";
import { PaymentGateway } from "./payment/gateway";

export interface Actor {
  id: string;
  role: string;
}

const ACTIVE_KITCHEN_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
] as const;

const round2 = (value: number): number => Math.round(value * 100) / 100;

function lineTotal(item: IOrderItem): number {
  return (item.finalPrice ?? item.price) * item.quantity;
}

async function assertManager(managerId: string): Promise<string> {
  const manager = await User.findById(managerId).select("role").lean();
  const role = (manager as { role?: string } | null)?.role;
  if (!role || !["manager", "admin"].includes(role)) {
    throw new Error("Manager authorization required");
  }
  return role;
}

// ---------------------------------------------------------------------------
// 1. Split bills
// ---------------------------------------------------------------------------

export interface SplitPortion {
  label: string;
  amount: number;
  itemIds?: string[];
}

export class SplitBillService {
  async evenSplit(orderId: string, ways: number): Promise<SplitPortion[]> {
    if (!Number.isInteger(ways) || ways < 1) {
      throw new Error("Split must be a positive whole number of ways");
    }
    const order = await Order.findById(orderId).lean();
    if (!order) throw new Error("Order not found");

    const total = order.totalAmount + (order.tipAmount ?? 0);
    const base = Math.floor((total / ways) * 100) / 100;
    const portions: SplitPortion[] = Array.from({ length: ways }, (_, i) => ({
      label: `Guest ${i + 1}`,
      amount: base,
    }));
    // Absorb the rounding remainder into the final portion.
    portions[ways - 1].amount = round2(total - base * (ways - 1));
    return portions;
  }

  async splitByItems(
    orderId: string,
    groups: { label: string; itemIds: string[] }[],
  ): Promise<SplitPortion[]> {
    const order = await Order.findById(orderId).lean();
    if (!order) throw new Error("Order not found");

    const itemById = new Map<string, IOrderItem>(
      (order.items as (IOrderItem & { _id: Types.ObjectId })[]).map((it) => [
        String(it._id),
        it,
      ]),
    );

    return groups.map((group) => {
      let amount = 0;
      for (const id of group.itemIds) {
        const item = itemById.get(id);
        if (!item) throw new Error(`Item ${id} is not part of this order`);
        amount += lineTotal(item);
      }
      return { label: group.label, amount: round2(amount), itemIds: group.itemIds };
    });
  }
}

// ---------------------------------------------------------------------------
// 2. Process payment (partial / split / tips)
// ---------------------------------------------------------------------------

export interface PaymentInput {
  orderId: string;
  amount: number;
  method: "cash" | "credit_card" | "khqr";
  tipAmount?: number;
  cardToken?: string;
  referenceId?: string;
  itemIds?: string[];
  actor: Actor;
}

export interface PaymentResult {
  paymentStatus: "unpaid" | "partially_paid" | "paid" | "refunded";
  amountPaid: number;
  amountDue: number;
  referenceId?: string;
}

export class ProcessPaymentUseCase {
  constructor(private gateway: PaymentGateway) {}

  async execute(input: PaymentInput): Promise<PaymentResult> {
    if (input.amount <= 0) throw new Error("Payment amount must be positive");

    const session = await mongoose.startSession();
    try {
      let result: PaymentResult | null = null;

      await session.withTransaction(async () => {
        const order = await Order.findById(input.orderId).session(session);
        if (!order) throw new Error("Order not found");
        if (order.paymentStatus === "paid") throw new Error("Order already fully paid");
        if (order.paymentStatus === "refunded") throw new Error("Order was refunded");

        let referenceId = input.referenceId;
        if (input.method === "credit_card") {
          const charge = await this.gateway.chargeCard(
            input.amount + (input.tipAmount ?? 0),
            input.cardToken ?? "",
          );
          if (!charge.success) throw new Error("Card charge failed");
          referenceId = charge.referenceId;
        } else if (input.method === "khqr") {
          if (!referenceId) throw new Error("KHQR referenceId required (generate QR first)");
          const verification = await this.gateway.verifyKHQR(referenceId);
          if (!verification.paid) throw new Error("KHQR payment not confirmed");
        }

        const payment: ISplitPayment = {
          amount: input.amount,
          method: input.method,
          referenceId,
          tipAmount: input.tipAmount ?? 0,
          itemIds: input.itemIds?.map((id) => new Types.ObjectId(id)),
          paidAt: new Date(),
        };
        order.splitDetails.push(payment);
        order.tipAmount = round2((order.tipAmount ?? 0) + (input.tipAmount ?? 0));
        order.amountPaid = round2((order.amountPaid ?? 0) + input.amount);

        const amountDue = order.totalAmount;
        if (order.amountPaid >= amountDue) order.paymentStatus = "paid";
        else if (order.amountPaid > 0) order.paymentStatus = "partially_paid";

        order.paymentMethod = order.splitDetails.length > 1 ? "split" : input.method;

        if (order.paymentStatus === "paid") {
          order.paidAt = new Date();
          order.ticketStatus = "completed";
          await Receipt.create(
            [
              {
                order: order._id,
                receiptNumber: `RCP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                paymentMethod: order.paymentMethod === "split" ? "split" : input.method,
                paymentStatus: "completed",
                subtotal: order.totalAmount + (order.totalDiscountAmount ?? 0),
                tax: 0,
                discount: order.totalDiscountAmount ?? 0,
                totalAmount: round2(order.totalAmount + order.tipAmount),
                items: order.items.map((it) => ({
                  menuItem: it.menuItem,
                  name: String(it.menuItem),
                  quantity: it.quantity,
                  price: it.finalPrice ?? it.price,
                })),
              },
            ],
            { session },
          );
        }

        await order.save({ session });

        await writeAudit(
          {
            userId: input.actor.id,
            userRole: input.actor.role,
            action: "PROCESS_PAYMENT",
            targetType: "Order",
            targetId: order._id as Types.ObjectId,
            metadata: { method: input.method, amount: input.amount, tip: input.tipAmount ?? 0 },
          },
          session,
        );

        result = {
          paymentStatus: order.paymentStatus,
          amountPaid: order.amountPaid,
          amountDue: round2(Math.max(0, amountDue - order.amountPaid)),
          referenceId,
        };
      });

      return result as unknown as PaymentResult;
    } finally {
      await session.endSession();
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Modify active order + 86 toggle
// ---------------------------------------------------------------------------

export type OrderEdit =
  | { op: "add"; menuItemId: string; quantity: number; specialInstructions?: string }
  | { op: "remove"; itemId: string }
  | { op: "qty"; itemId: string; quantity: number };

export class ModifyOrderUseCase {
  async execute(orderId: string, edits: OrderEdit[], actor: Actor): Promise<unknown> {
    const session = await mongoose.startSession();
    try {
      let updated: unknown = null;

      await session.withTransaction(async () => {
        const order = await Order.findById(orderId).session(session);
        if (!order) throw new Error("Order not found");
        if (!ACTIVE_KITCHEN_STATUSES.includes(order.status as never)) {
          throw new Error(`Cannot edit a ${order.status} order`);
        }
        if (order.ticketStatus !== "active") throw new Error(`Cannot edit a ${order.ticketStatus} ticket`);
        if (order.paymentStatus === "paid") throw new Error("Cannot edit a paid order");

        const before = order.toObject();
        const items = order.items as unknown as Types.DocumentArray<
          IOrderItem & Types.Subdocument & { _id: Types.ObjectId }
        >;

        for (const edit of edits) {
          if (edit.op === "add") {
            if (edit.quantity <= 0) throw new Error("Quantity must be positive");
            const menuItem = await MenuItem.findById(edit.menuItemId).session(session).lean();
            if (!menuItem) throw new Error("Menu item not found");
            if ((menuItem as { availability?: boolean }).availability === false) {
              throw new Error(`${(menuItem as { name?: string }).name ?? "Item"} is 86'd`);
            }
            await applyInventoryDelta(
              [{ menuItem: edit.menuItemId, quantity: edit.quantity }],
              -1,
              session,
            );
            const price = (menuItem as { price: number }).price;
            items.push({
              menuItem: new Types.ObjectId(edit.menuItemId),
              quantity: edit.quantity,
              price,
              finalPrice: price,
              specialInstructions: edit.specialInstructions,
              status: "pending",
            } as IOrderItem);
            order.revisions.push({
              at: new Date(),
              by: new Types.ObjectId(actor.id),
              change: "add",
              menuItem: new Types.ObjectId(edit.menuItemId),
              delta: edit.quantity,
            });
          } else {
            const item = items.id(edit.itemId);
            if (!item) throw new Error(`Order item ${edit.itemId} not found`);
            if (item.status === "served") throw new Error("Cannot modify a served item");

            if (edit.op === "remove") {
              await applyInventoryDelta(
                [{ menuItem: item.menuItem, quantity: item.quantity }],
                1,
                session,
              );
              order.revisions.push({
                at: new Date(),
                by: new Types.ObjectId(actor.id),
                change: "remove",
                menuItem: item.menuItem,
                delta: -item.quantity,
              });
              item.deleteOne();
            } else {
              if (edit.quantity <= 0) throw new Error("Quantity must be positive");
              const diff = edit.quantity - item.quantity;
              if (diff !== 0) {
                await applyInventoryDelta(
                  [{ menuItem: item.menuItem, quantity: Math.abs(diff) }],
                  diff > 0 ? -1 : 1,
                  session,
                );
                order.revisions.push({
                  at: new Date(),
                  by: new Types.ObjectId(actor.id),
                  change: "qty",
                  menuItem: item.menuItem,
                  delta: diff,
                });
                item.quantity = edit.quantity;
              }
            }
          }
        }

        order.totalAmount = round2(
          order.items.reduce((sum, it) => sum + lineTotal(it), 0),
        );
        await order.save({ session });

        await writeAudit(
          {
            userId: actor.id,
            userRole: actor.role,
            action: "MODIFY_ORDER",
            targetType: "Order",
            targetId: order._id as Types.ObjectId,
            diff: { before, after: order.toObject() },
          },
          session,
        );

        updated = order.toObject();
      });

      return updated;
    } finally {
      await session.endSession();
    }
  }
}

export class ToggleItemAvailabilityUseCase {
  async execute(menuItemId: string, available: boolean, actor: Actor): Promise<unknown> {
    const item = await MenuItem.findByIdAndUpdate(
      menuItemId,
      { availability: available },
      { new: true },
    );
    if (!item) throw new Error("Menu item not found");

    await writeAudit({
      userId: actor.id,
      userRole: actor.role,
      action: "TOGGLE_86",
      targetType: "MenuItem",
      targetId: item._id as Types.ObjectId,
      metadata: { available },
    });
    return item;
  }
}

// ---------------------------------------------------------------------------
// 4. Voids & comps (manager-gated, audited, inventory-reverting)
// ---------------------------------------------------------------------------

export const VOID_REASONS = [
  "customer_changed_mind",
  "kitchen_error",
  "wrong_item",
  "quality_issue",
  "duplicate",
  "other",
] as const;
export type VoidReason = (typeof VOID_REASONS)[number];

export class VoidOrderUseCase {
  async execute(orderId: string, reason: VoidReason, managerId: string): Promise<void> {
    const role = await assertManager(managerId);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const order = await Order.findById(orderId).session(session);
        if (!order) throw new Error("Order not found");
        if (order.ticketStatus === "voided" || order.status === "cancelled") {
          throw new Error("Order already voided");
        }
        if (order.paymentStatus === "paid") {
          throw new Error("Order is paid — use the refund flow");
        }

        const before = order.toObject();
        // Only credit back ingredients for items the kitchen actually started.
        const cooked = order.items.filter(
          (it) => it.status === "fired" || it.status === "served",
        );
        if (cooked.length > 0) {
          await applyInventoryDelta(
            cooked.map((it) => ({ menuItem: it.menuItem, quantity: it.quantity })),
            1,
            session,
          );
        }

        order.status = "cancelled";
        order.ticketStatus = "voided";
        order.cancelledReason = reason;
        await order.save({ session });

        await writeAudit(
          {
            userId: managerId,
            userRole: role,
            action: "VOID_ORDER",
            targetType: "Order",
            targetId: order._id as Types.ObjectId,
            reason,
            diff: { before, after: order.toObject() },
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }
  }
}

export class CompOrderUseCase {
  async execute(orderId: string, reason: string, managerId: string): Promise<void> {
    const role = await assertManager(managerId);
    if (!reason || reason.trim().length === 0) throw new Error("A comp reason is required");

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const order = await Order.findById(orderId).session(session);
        if (!order) throw new Error("Order not found");
        if (order.paymentStatus === "paid") throw new Error("Order already paid");

        const before = order.toObject();
        order.totalDiscountAmount = round2((order.totalDiscountAmount ?? 0) + order.totalAmount);
        order.totalAmount = 0;
        order.paymentStatus = "paid";
        order.paidAt = new Date();
        order.ticketStatus = "completed";
        await order.save({ session });

        await writeAudit(
          {
            userId: managerId,
            userRole: role,
            action: "COMP_ORDER",
            targetType: "Order",
            targetId: order._id as Types.ObjectId,
            reason,
            diff: { before, after: order.toObject() },
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Table operations
// ---------------------------------------------------------------------------

export class TransferTableUseCase {
  async execute(fromTable: number, toTable: number, actor: Actor): Promise<unknown> {
    if (fromTable === toTable) throw new Error("Source and destination tables are the same");
    const session = await mongoose.startSession();
    try {
      let moved: unknown = null;
      await session.withTransaction(async () => {
        const occupied = await Order.findOne({
          tableNumber: toTable,
          status: { $in: ACTIVE_KITCHEN_STATUSES },
        }).session(session);
        if (occupied) throw new Error(`Table ${toTable} is occupied — merge instead`);

        const order = await Order.findOne({
          tableNumber: fromTable,
          status: { $in: ACTIVE_KITCHEN_STATUSES },
        }).session(session);
        if (!order) throw new Error(`No active order at table ${fromTable}`);

        order.tableNumber = toTable;
        await order.save({ session });

        await writeAudit(
          {
            userId: actor.id,
            userRole: actor.role,
            action: "TRANSFER_TABLE",
            targetType: "Order",
            targetId: order._id as Types.ObjectId,
            diff: { before: { tableNumber: fromTable }, after: { tableNumber: toTable } },
          },
          session,
        );

        moved = order.toObject();
      });
      return moved;
    } finally {
      await session.endSession();
    }
  }
}

export class MergeTablesUseCase {
  async execute(sourceTable: number, targetTable: number, actor: Actor): Promise<unknown> {
    if (sourceTable === targetTable) throw new Error("Cannot merge a table into itself");
    const session = await mongoose.startSession();
    try {
      let merged: unknown = null;
      await session.withTransaction(async () => {
        const target = await Order.findOne({
          tableNumber: targetTable,
          status: { $in: ACTIVE_KITCHEN_STATUSES },
        }).session(session);
        const source = await Order.findOne({
          tableNumber: sourceTable,
          status: { $in: ACTIVE_KITCHEN_STATUSES },
        }).session(session);
        if (!target || !source) throw new Error("Both tables must have an active order to merge");

        target.items.push(...source.items);
        target.totalAmount = round2(target.totalAmount + source.totalAmount);
        target.totalDiscountAmount = round2(
          (target.totalDiscountAmount ?? 0) + (source.totalDiscountAmount ?? 0),
        );

        // Free the source table first so the one-active-order-per-table index holds.
        source.status = "cancelled";
        source.ticketStatus = "voided";
        source.cancelledReason = `Merged into table ${targetTable}`;
        await source.save({ session });
        await target.save({ session });

        await writeAudit(
          {
            userId: actor.id,
            userRole: actor.role,
            action: "MERGE_TABLES",
            targetType: "Order",
            targetId: target._id as Types.ObjectId,
            metadata: { sourceTable, targetTable, mergedFromOrder: String(source._id) },
          },
          session,
        );

        merged = target.toObject();
      });
      return merged;
    } finally {
      await session.endSession();
    }
  }
}

// ---------------------------------------------------------------------------
// 6. Shift / cash-drawer reconciliation
// ---------------------------------------------------------------------------

export class OpenShiftUseCase {
  async execute(startingFloat: number, actor: Actor): Promise<unknown> {
    if (startingFloat < 0) throw new Error("Starting float cannot be negative");
    const existing = await Shift.findOne({ status: "open" });
    if (existing) throw new Error("A shift is already open");

    const shift = await Shift.create({
      openedBy: new Types.ObjectId(actor.id),
      startingFloat,
      status: "open",
    });

    await writeAudit({
      userId: actor.id,
      userRole: actor.role,
      action: "OPEN_SHIFT",
      targetType: "Shift",
      targetId: shift._id as Types.ObjectId,
      metadata: { startingFloat },
    });
    return shift;
  }
}

export class CloseShiftUseCase {
  async execute(actualCashCounted: number, actor: Actor): Promise<IZReport> {
    if (actualCashCounted < 0) throw new Error("Counted cash cannot be negative");
    const shift = await Shift.findOne({ status: "open" });
    if (!shift) throw new Error("No open shift to close");

    const orders = await Order.find({
      paidAt: { $gte: shift.openedAt },
      $or: [{ paymentMethod: "cash" }, { "splitDetails.method": "cash" }],
    }).lean();

    let cashSales = 0;
    let cashTips = 0;
    let cardSales = 0;
    let khqrSales = 0;

    for (const order of orders) {
      const splits = (order.splitDetails ?? []) as ISplitPayment[];
      if (splits.length > 0) {
        for (const split of splits) {
          if (split.method === "cash") {
            cashSales += split.amount;
            cashTips += split.tipAmount ?? 0;
          } else if (split.method === "credit_card") {
            cardSales += split.amount;
          } else if (split.method === "khqr") {
            khqrSales += split.amount;
          }
        }
      } else if (order.paymentMethod === "cash") {
        cashSales += order.totalAmount;
        cashTips += order.tipAmount ?? 0;
      }
    }

    const expectedCash = round2(shift.startingFloat + cashSales + cashTips);
    const discrepancy = round2(actualCashCounted - expectedCash);

    const zReport: IZReport = {
      shiftId: String(shift._id),
      openedAt: shift.openedAt,
      closedAt: new Date(),
      startingFloat: shift.startingFloat,
      cashSales: round2(cashSales),
      cashTips: round2(cashTips),
      cardSales: round2(cardSales),
      khqrSales: round2(khqrSales),
      expectedCash,
      actualCashCounted,
      discrepancy,
      orderCount: orders.length,
    };

    shift.closedBy = new Types.ObjectId(actor.id);
    shift.closedAt = zReport.closedAt;
    shift.expectedCash = expectedCash;
    shift.actualCashCounted = actualCashCounted;
    shift.discrepancy = discrepancy;
    shift.status = "closed";
    shift.zReport = zReport;
    await shift.save();

    await writeAudit({
      userId: actor.id,
      userRole: actor.role,
      action: "CLOSE_SHIFT",
      targetType: "Shift",
      targetId: shift._id as Types.ObjectId,
      metadata: { ...zReport },
    });

    return zReport;
  }
}
