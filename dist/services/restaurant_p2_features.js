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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseShiftUseCase = exports.OpenShiftUseCase = exports.MergeTablesUseCase = exports.TransferTableUseCase = exports.CompOrderUseCase = exports.VoidOrderUseCase = exports.VOID_REASONS = exports.ToggleItemAvailabilityUseCase = exports.ModifyOrderUseCase = exports.ProcessPaymentUseCase = exports.SplitBillService = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const Order_1 = __importDefault(require("../models/Order"));
const MenuItem_1 = __importDefault(require("../models/MenuItem"));
const User_1 = __importDefault(require("../models/User"));
const Receipt_1 = __importDefault(require("../models/Receipt"));
const Shift_1 = __importDefault(require("../models/Shift"));
const audit_1 = require("./audit");
const inventory_adjustment_1 = require("./inventory-adjustment");
const ACTIVE_KITCHEN_STATUSES = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
];
const round2 = (value) => Math.round(value * 100) / 100;
function lineTotal(item) {
    var _a;
    return ((_a = item.finalPrice) !== null && _a !== void 0 ? _a : item.price) * item.quantity;
}
async function assertManager(managerId) {
    const id = String(managerId);
    if (!mongoose_1.default.isValidObjectId(id)) {
        throw new Error("Manager authorization required");
    }
    const manager = await User_1.default.findById(id).select("role").lean();
    const role = manager === null || manager === void 0 ? void 0 : manager.role;
    if (!role || !["manager", "admin"].includes(role)) {
        throw new Error("Manager authorization required");
    }
    return role;
}
class SplitBillService {
    async evenSplit(orderId, ways) {
        var _a;
        if (!Number.isInteger(ways) || ways < 1) {
            throw new Error("Split must be a positive whole number of ways");
        }
        const order = await Order_1.default.findById(orderId).lean();
        if (!order)
            throw new Error("Order not found");
        const total = order.totalAmount + ((_a = order.tipAmount) !== null && _a !== void 0 ? _a : 0);
        const base = Math.floor((total / ways) * 100) / 100;
        const portions = Array.from({ length: ways }, (_, i) => ({
            label: `Guest ${i + 1}`,
            amount: base,
        }));
        portions[ways - 1].amount = round2(total - base * (ways - 1));
        return portions;
    }
    async splitByItems(orderId, groups) {
        const order = await Order_1.default.findById(orderId).lean();
        if (!order)
            throw new Error("Order not found");
        const itemById = new Map(order.items.map((it) => [
            String(it._id),
            it,
        ]));
        return groups.map((group) => {
            let amount = 0;
            for (const id of group.itemIds) {
                const item = itemById.get(id);
                if (!item)
                    throw new Error(`Item ${id} is not part of this order`);
                amount += lineTotal(item);
            }
            return { label: group.label, amount: round2(amount), itemIds: group.itemIds };
        });
    }
}
exports.SplitBillService = SplitBillService;
class ProcessPaymentUseCase {
    constructor(gateway) {
        this.gateway = gateway;
    }
    async execute(input) {
        if (input.amount <= 0)
            throw new Error("Payment amount must be positive");
        const session = await mongoose_1.default.startSession();
        try {
            let result = null;
            await session.withTransaction(async () => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                const order = await Order_1.default.findById(input.orderId).session(session);
                if (!order)
                    throw new Error("Order not found");
                if (order.paymentStatus === "paid")
                    throw new Error("Order already fully paid");
                if (order.paymentStatus === "refunded")
                    throw new Error("Order was refunded");
                let referenceId = input.referenceId;
                if (input.method === "credit_card") {
                    const charge = await this.gateway.chargeCard(input.amount + ((_a = input.tipAmount) !== null && _a !== void 0 ? _a : 0), (_b = input.cardToken) !== null && _b !== void 0 ? _b : "");
                    if (!charge.success)
                        throw new Error("Card charge failed");
                    referenceId = charge.referenceId;
                }
                else if (input.method === "khqr") {
                    if (!referenceId)
                        throw new Error("KHQR referenceId required (generate QR first)");
                    const verification = await this.gateway.verifyKHQR(referenceId);
                    if (!verification.paid)
                        throw new Error("KHQR payment not confirmed");
                }
                const payment = {
                    amount: input.amount,
                    method: input.method,
                    referenceId,
                    tipAmount: (_c = input.tipAmount) !== null && _c !== void 0 ? _c : 0,
                    itemIds: (_d = input.itemIds) === null || _d === void 0 ? void 0 : _d.map((id) => new mongoose_1.Types.ObjectId(id)),
                    paidAt: new Date(),
                };
                order.splitDetails.push(payment);
                order.tipAmount = round2(((_e = order.tipAmount) !== null && _e !== void 0 ? _e : 0) + ((_f = input.tipAmount) !== null && _f !== void 0 ? _f : 0));
                order.amountPaid = round2(((_g = order.amountPaid) !== null && _g !== void 0 ? _g : 0) + input.amount);
                const amountDue = order.totalAmount;
                if (order.amountPaid >= amountDue)
                    order.paymentStatus = "paid";
                else if (order.amountPaid > 0)
                    order.paymentStatus = "partially_paid";
                order.paymentMethod = order.splitDetails.length > 1 ? "split" : input.method;
                if (order.paymentStatus === "paid") {
                    order.paidAt = new Date();
                    order.ticketStatus = "completed";
                    await Receipt_1.default.create([
                        {
                            order: order._id,
                            receiptNumber: `RCP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                            paymentMethod: order.paymentMethod === "split" ? "split" : input.method,
                            paymentStatus: "completed",
                            subtotal: order.totalAmount + ((_h = order.totalDiscountAmount) !== null && _h !== void 0 ? _h : 0),
                            tax: 0,
                            discount: (_j = order.totalDiscountAmount) !== null && _j !== void 0 ? _j : 0,
                            totalAmount: round2(order.totalAmount + order.tipAmount),
                            items: order.items.map((it) => {
                                var _a;
                                return ({
                                    menuItem: it.menuItem,
                                    name: String(it.menuItem),
                                    quantity: it.quantity,
                                    price: (_a = it.finalPrice) !== null && _a !== void 0 ? _a : it.price,
                                });
                            }),
                        },
                    ], { session });
                }
                await order.save({ session });
                await (0, audit_1.writeAudit)({
                    userId: input.actor.id,
                    userRole: input.actor.role,
                    action: "PROCESS_PAYMENT",
                    targetType: "Order",
                    targetId: order._id,
                    metadata: { method: input.method, amount: input.amount, tip: (_k = input.tipAmount) !== null && _k !== void 0 ? _k : 0 },
                }, session);
                result = {
                    paymentStatus: order.paymentStatus,
                    amountPaid: order.amountPaid,
                    amountDue: round2(Math.max(0, amountDue - order.amountPaid)),
                    referenceId,
                };
            });
            return result;
        }
        finally {
            await session.endSession();
        }
    }
}
exports.ProcessPaymentUseCase = ProcessPaymentUseCase;
class ModifyOrderUseCase {
    async execute(orderId, edits, actor) {
        const session = await mongoose_1.default.startSession();
        try {
            let updated = null;
            await session.withTransaction(async () => {
                var _a;
                const order = await Order_1.default.findById(orderId).session(session);
                if (!order)
                    throw new Error("Order not found");
                if (!ACTIVE_KITCHEN_STATUSES.includes(order.status)) {
                    throw new Error(`Cannot edit a ${order.status} order`);
                }
                if (order.ticketStatus !== "active")
                    throw new Error(`Cannot edit a ${order.ticketStatus} ticket`);
                if (order.paymentStatus === "paid")
                    throw new Error("Cannot edit a paid order");
                const before = order.toObject();
                const items = order.items;
                for (const edit of edits) {
                    if (edit.op === "add") {
                        if (edit.quantity <= 0)
                            throw new Error("Quantity must be positive");
                        const menuItemId = String(edit.menuItemId);
                        if (!mongoose_1.default.isValidObjectId(menuItemId)) {
                            throw new Error("Menu item not found");
                        }
                        const menuItem = await MenuItem_1.default.findById(menuItemId).session(session).lean();
                        if (!menuItem)
                            throw new Error("Menu item not found");
                        if (menuItem.availability === false) {
                            throw new Error(`${(_a = menuItem.name) !== null && _a !== void 0 ? _a : "Item"} is 86'd`);
                        }
                        await (0, inventory_adjustment_1.applyInventoryDelta)([{ menuItem: edit.menuItemId, quantity: edit.quantity }], -1, session);
                        const price = menuItem.price;
                        items.push({
                            menuItem: new mongoose_1.Types.ObjectId(edit.menuItemId),
                            quantity: edit.quantity,
                            price,
                            finalPrice: price,
                            specialInstructions: edit.specialInstructions,
                            status: "pending",
                        });
                        order.revisions.push({
                            at: new Date(),
                            by: new mongoose_1.Types.ObjectId(actor.id),
                            change: "add",
                            menuItem: new mongoose_1.Types.ObjectId(edit.menuItemId),
                            delta: edit.quantity,
                        });
                    }
                    else {
                        const item = items.id(edit.itemId);
                        if (!item)
                            throw new Error(`Order item ${edit.itemId} not found`);
                        if (item.status === "served")
                            throw new Error("Cannot modify a served item");
                        if (edit.op === "remove") {
                            await (0, inventory_adjustment_1.applyInventoryDelta)([{ menuItem: item.menuItem, quantity: item.quantity }], 1, session);
                            order.revisions.push({
                                at: new Date(),
                                by: new mongoose_1.Types.ObjectId(actor.id),
                                change: "remove",
                                menuItem: item.menuItem,
                                delta: -item.quantity,
                            });
                            item.deleteOne();
                        }
                        else {
                            if (edit.quantity <= 0)
                                throw new Error("Quantity must be positive");
                            const diff = edit.quantity - item.quantity;
                            if (diff !== 0) {
                                await (0, inventory_adjustment_1.applyInventoryDelta)([{ menuItem: item.menuItem, quantity: Math.abs(diff) }], diff > 0 ? -1 : 1, session);
                                order.revisions.push({
                                    at: new Date(),
                                    by: new mongoose_1.Types.ObjectId(actor.id),
                                    change: "qty",
                                    menuItem: item.menuItem,
                                    delta: diff,
                                });
                                item.quantity = edit.quantity;
                            }
                        }
                    }
                }
                order.totalAmount = round2(order.items.reduce((sum, it) => sum + lineTotal(it), 0));
                await order.save({ session });
                await (0, audit_1.writeAudit)({
                    userId: actor.id,
                    userRole: actor.role,
                    action: "MODIFY_ORDER",
                    targetType: "Order",
                    targetId: order._id,
                    diff: { before, after: order.toObject() },
                }, session);
                updated = order.toObject();
            });
            return updated;
        }
        finally {
            await session.endSession();
        }
    }
}
exports.ModifyOrderUseCase = ModifyOrderUseCase;
class ToggleItemAvailabilityUseCase {
    async execute(menuItemId, available, actor) {
        const item = await MenuItem_1.default.findByIdAndUpdate(menuItemId, { availability: available }, { new: true });
        if (!item)
            throw new Error("Menu item not found");
        await (0, audit_1.writeAudit)({
            userId: actor.id,
            userRole: actor.role,
            action: "TOGGLE_86",
            targetType: "MenuItem",
            targetId: item._id,
            metadata: { available },
        });
        return item;
    }
}
exports.ToggleItemAvailabilityUseCase = ToggleItemAvailabilityUseCase;
exports.VOID_REASONS = [
    "customer_changed_mind",
    "kitchen_error",
    "wrong_item",
    "quality_issue",
    "duplicate",
    "other",
];
class VoidOrderUseCase {
    async execute(orderId, reason, managerId) {
        const role = await assertManager(managerId);
        const session = await mongoose_1.default.startSession();
        try {
            await session.withTransaction(async () => {
                const order = await Order_1.default.findById(orderId).session(session);
                if (!order)
                    throw new Error("Order not found");
                if (order.ticketStatus === "voided" || order.status === "cancelled") {
                    throw new Error("Order already voided");
                }
                if (order.paymentStatus === "paid") {
                    throw new Error("Order is paid — use the refund flow");
                }
                const before = order.toObject();
                const cooked = order.items.filter((it) => it.status === "fired" || it.status === "served");
                if (cooked.length > 0) {
                    await (0, inventory_adjustment_1.applyInventoryDelta)(cooked.map((it) => ({ menuItem: it.menuItem, quantity: it.quantity })), 1, session);
                }
                order.status = "cancelled";
                order.ticketStatus = "voided";
                order.cancelledReason = reason;
                await order.save({ session });
                await (0, audit_1.writeAudit)({
                    userId: managerId,
                    userRole: role,
                    action: "VOID_ORDER",
                    targetType: "Order",
                    targetId: order._id,
                    reason,
                    diff: { before, after: order.toObject() },
                }, session);
            });
        }
        finally {
            await session.endSession();
        }
    }
}
exports.VoidOrderUseCase = VoidOrderUseCase;
class CompOrderUseCase {
    async execute(orderId, reason, managerId) {
        const role = await assertManager(managerId);
        if (!reason || reason.trim().length === 0)
            throw new Error("A comp reason is required");
        const session = await mongoose_1.default.startSession();
        try {
            await session.withTransaction(async () => {
                var _a;
                const order = await Order_1.default.findById(orderId).session(session);
                if (!order)
                    throw new Error("Order not found");
                if (order.paymentStatus === "paid")
                    throw new Error("Order already paid");
                const before = order.toObject();
                order.totalDiscountAmount = round2(((_a = order.totalDiscountAmount) !== null && _a !== void 0 ? _a : 0) + order.totalAmount);
                order.totalAmount = 0;
                order.paymentStatus = "paid";
                order.paidAt = new Date();
                order.ticketStatus = "completed";
                await order.save({ session });
                await (0, audit_1.writeAudit)({
                    userId: managerId,
                    userRole: role,
                    action: "COMP_ORDER",
                    targetType: "Order",
                    targetId: order._id,
                    reason,
                    diff: { before, after: order.toObject() },
                }, session);
            });
        }
        finally {
            await session.endSession();
        }
    }
}
exports.CompOrderUseCase = CompOrderUseCase;
class TransferTableUseCase {
    async execute(fromTable, toTable, actor) {
        if (fromTable === toTable)
            throw new Error("Source and destination tables are the same");
        const session = await mongoose_1.default.startSession();
        try {
            let moved = null;
            await session.withTransaction(async () => {
                const occupied = await Order_1.default.findOne({
                    tableNumber: toTable,
                    status: { $in: ACTIVE_KITCHEN_STATUSES },
                }).session(session);
                if (occupied)
                    throw new Error(`Table ${toTable} is occupied — merge instead`);
                const order = await Order_1.default.findOne({
                    tableNumber: fromTable,
                    status: { $in: ACTIVE_KITCHEN_STATUSES },
                }).session(session);
                if (!order)
                    throw new Error(`No active order at table ${fromTable}`);
                order.tableNumber = toTable;
                await order.save({ session });
                await (0, audit_1.writeAudit)({
                    userId: actor.id,
                    userRole: actor.role,
                    action: "TRANSFER_TABLE",
                    targetType: "Order",
                    targetId: order._id,
                    diff: { before: { tableNumber: fromTable }, after: { tableNumber: toTable } },
                }, session);
                moved = order.toObject();
            });
            return moved;
        }
        finally {
            await session.endSession();
        }
    }
}
exports.TransferTableUseCase = TransferTableUseCase;
class MergeTablesUseCase {
    async execute(sourceTable, targetTable, actor) {
        if (sourceTable === targetTable)
            throw new Error("Cannot merge a table into itself");
        const session = await mongoose_1.default.startSession();
        try {
            let merged = null;
            await session.withTransaction(async () => {
                var _a, _b;
                const target = await Order_1.default.findOne({
                    tableNumber: targetTable,
                    status: { $in: ACTIVE_KITCHEN_STATUSES },
                }).session(session);
                const source = await Order_1.default.findOne({
                    tableNumber: sourceTable,
                    status: { $in: ACTIVE_KITCHEN_STATUSES },
                }).session(session);
                if (!target || !source)
                    throw new Error("Both tables must have an active order to merge");
                target.items.push(...source.items);
                target.totalAmount = round2(target.totalAmount + source.totalAmount);
                target.totalDiscountAmount = round2(((_a = target.totalDiscountAmount) !== null && _a !== void 0 ? _a : 0) + ((_b = source.totalDiscountAmount) !== null && _b !== void 0 ? _b : 0));
                source.status = "cancelled";
                source.ticketStatus = "voided";
                source.cancelledReason = `Merged into table ${targetTable}`;
                await source.save({ session });
                await target.save({ session });
                await (0, audit_1.writeAudit)({
                    userId: actor.id,
                    userRole: actor.role,
                    action: "MERGE_TABLES",
                    targetType: "Order",
                    targetId: target._id,
                    metadata: { sourceTable, targetTable, mergedFromOrder: String(source._id) },
                }, session);
                merged = target.toObject();
            });
            return merged;
        }
        finally {
            await session.endSession();
        }
    }
}
exports.MergeTablesUseCase = MergeTablesUseCase;
class OpenShiftUseCase {
    async execute(startingFloat, actor) {
        if (startingFloat < 0)
            throw new Error("Starting float cannot be negative");
        const existing = await Shift_1.default.findOne({ status: "open" });
        if (existing)
            throw new Error("A shift is already open");
        const shift = await Shift_1.default.create({
            openedBy: new mongoose_1.Types.ObjectId(actor.id),
            startingFloat,
            status: "open",
        });
        await (0, audit_1.writeAudit)({
            userId: actor.id,
            userRole: actor.role,
            action: "OPEN_SHIFT",
            targetType: "Shift",
            targetId: shift._id,
            metadata: { startingFloat },
        });
        return shift;
    }
}
exports.OpenShiftUseCase = OpenShiftUseCase;
class CloseShiftUseCase {
    async execute(actualCashCounted, actor) {
        var _a, _b, _c;
        if (actualCashCounted < 0)
            throw new Error("Counted cash cannot be negative");
        const shift = await Shift_1.default.findOne({ status: "open" });
        if (!shift)
            throw new Error("No open shift to close");
        const orders = await Order_1.default.find({
            paidAt: { $gte: shift.openedAt },
            $or: [{ paymentMethod: "cash" }, { "splitDetails.method": "cash" }],
        }).lean();
        let cashSales = 0;
        let cashTips = 0;
        let cardSales = 0;
        let khqrSales = 0;
        for (const order of orders) {
            const splits = ((_a = order.splitDetails) !== null && _a !== void 0 ? _a : []);
            if (splits.length > 0) {
                for (const split of splits) {
                    if (split.method === "cash") {
                        cashSales += split.amount;
                        cashTips += (_b = split.tipAmount) !== null && _b !== void 0 ? _b : 0;
                    }
                    else if (split.method === "credit_card") {
                        cardSales += split.amount;
                    }
                    else if (split.method === "khqr") {
                        khqrSales += split.amount;
                    }
                }
            }
            else if (order.paymentMethod === "cash") {
                cashSales += order.totalAmount;
                cashTips += (_c = order.tipAmount) !== null && _c !== void 0 ? _c : 0;
            }
        }
        const expectedCash = round2(shift.startingFloat + cashSales + cashTips);
        const discrepancy = round2(actualCashCounted - expectedCash);
        const zReport = {
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
        shift.closedBy = new mongoose_1.Types.ObjectId(actor.id);
        shift.closedAt = zReport.closedAt;
        shift.expectedCash = expectedCash;
        shift.actualCashCounted = actualCashCounted;
        shift.discrepancy = discrepancy;
        shift.status = "closed";
        shift.zReport = zReport;
        await shift.save();
        await (0, audit_1.writeAudit)({
            userId: actor.id,
            userRole: actor.role,
            action: "CLOSE_SHIFT",
            targetType: "Shift",
            targetId: shift._id,
            metadata: Object.assign({}, zReport),
        });
        return zReport;
    }
}
exports.CloseShiftUseCase = CloseShiftUseCase;
//# sourceMappingURL=restaurant_p2_features.js.map