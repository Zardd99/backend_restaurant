"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.floorMapService = exports.splitTablesUseCase = exports.joinTablesUseCase = exports.busTableUseCase = exports.checkoutTableUseCase = exports.seatGuestsUseCase = exports.autoAllocationService = exports.FloorMapService = exports.SplitTablesUseCase = exports.JoinTablesUseCase = exports.BusTableUseCase = exports.CheckoutTableUseCase = exports.SeatGuestsUseCase = exports.AutoAllocationService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Table_1 = __importDefault(require("../models/Table"));
const TableReservation_1 = __importDefault(require("../models/TableReservation"));
const Order_1 = __importDefault(require("../models/Order"));
const audit_1 = require("./audit");
const RESERVATION_LOOKAHEAD_MS = 2 * 60 * 60 * 1000;
function unionCapacity(table, group) {
    const members = group.filter((t) => t.tableNumber === table.tableNumber ||
        table.joinedWith.includes(t.tableNumber));
    return members.reduce((sum, t) => sum + t.capacity, 0) || table.capacity;
}
async function reservedTableIdsWithin(candidateIds, session, now) {
    if (candidateIds.length === 0)
        return new Set();
    const horizon = new Date(now.getTime() + RESERVATION_LOOKAHEAD_MS);
    const reservations = await TableReservation_1.default.find({
        tableId: { $in: candidateIds },
        status: "pending",
        reservedFor: { $gte: now, $lte: horizon },
    })
        .select("tableId")
        .session(session)
        .lean();
    return new Set(reservations.map((r) => String(r.tableId)));
}
class AutoAllocationService {
    async findAndAssignTable(input) {
        const { partySize, section, actor } = input;
        if (!Number.isInteger(partySize) || partySize < 1) {
            throw new Error("Party size must be a positive whole number");
        }
        const session = await mongoose_1.default.startSession();
        try {
            let assigned = null;
            await session.withTransaction(async () => {
                const now = new Date();
                const sectionFilter = section ? { section } : {};
                const vacant = (await Table_1.default.find(Object.assign({ status: "vacant" }, sectionFilter))
                    .sort({ capacity: 1, vacantSince: 1 })
                    .session(session));
                const reserved = await reservedTableIdsWithin(vacant.map((t) => t._id), session, now);
                const seatable = vacant.filter((t) => !reserved.has(String(t._id)));
                const single = seatable.find((t) => t.capacity >= partySize);
                if (single) {
                    single.status = "occupied";
                    single.currentGuestCount = partySize;
                    single.vacantSince = null;
                    single.reservationTime = null;
                    await single.save({ session });
                    await (0, audit_1.writeAudit)({
                        userId: actor.id,
                        userRole: actor.role,
                        action: "AUTO_ASSIGN_TABLE",
                        targetType: "Table",
                        targetId: single._id,
                        metadata: { partySize, mode: "single", section: single.section },
                    }, session);
                    assigned = single.toObject();
                    return;
                }
                const combineSection = section !== null && section !== void 0 ? section : this.bestCombineSection(seatable, partySize);
                const pool = seatable
                    .filter((t) => t.section === combineSection)
                    .sort((a, b) => b.capacity - a.capacity);
                const group = [];
                let combinedCapacity = 0;
                for (const table of pool) {
                    group.push(table);
                    combinedCapacity += table.capacity;
                    if (combinedCapacity >= partySize)
                        break;
                }
                if (group.length < 2 || combinedCapacity < partySize) {
                    throw new Error(await this.explainFailure(partySize, section, session));
                }
                const numbers = group.map((t) => t.tableNumber);
                const primary = group[0];
                for (const table of group) {
                    table.status = "occupied";
                    table.joinedWith = numbers.filter((n) => n !== table.tableNumber);
                    table.vacantSince = null;
                    table.reservationTime = null;
                    table.currentGuestCount = table === primary ? partySize : 0;
                    await table.save({ session });
                }
                await (0, audit_1.writeAudit)({
                    userId: actor.id,
                    userRole: actor.role,
                    action: "AUTO_ASSIGN_TABLE",
                    targetType: "Table",
                    targetId: primary._id,
                    metadata: {
                        partySize,
                        mode: "combined",
                        section: combineSection,
                        tables: numbers,
                        combinedCapacity,
                    },
                }, session);
                assigned = primary.toObject();
            });
            return assigned;
        }
        finally {
            await session.endSession();
        }
    }
    bestCombineSection(seatable, partySize) {
        var _a, _b, _c;
        const bySection = new Map();
        for (const t of seatable) {
            bySection.set(t.section, ((_a = bySection.get(t.section)) !== null && _a !== void 0 ? _a : 0) + t.capacity);
        }
        let best = null;
        let bestCapacity = -1;
        for (const [sec, cap] of bySection) {
            if (cap >= partySize && (best === null || cap < bestCapacity)) {
                best = sec;
                bestCapacity = cap;
            }
        }
        if (best)
            return best;
        return (_c = (_b = [...bySection.entries()].sort((a, b) => b[1] - a[1])[0]) === null || _b === void 0 ? void 0 : _b[0]) !== null && _c !== void 0 ? _c : "indoor";
    }
    async explainFailure(partySize, section, session) {
        const sectionFilter = section ? { section } : {};
        const dirty = await Table_1.default.countDocuments(Object.assign({ status: "dirty" }, sectionFilter)).session(session);
        const reserved = await Table_1.default.countDocuments(Object.assign({ status: "reserved" }, sectionFilter)).session(session);
        const where = section ? ` in section "${section}"` : "";
        return (`No vacant tables matching a party of ${partySize}${where}. ` +
            `${dirty} dirty table(s) await bussing, ${reserved} reserved.`);
    }
}
exports.AutoAllocationService = AutoAllocationService;
class SeatGuestsUseCase {
    async execute(input) {
        const { tableId, orderId, guestCount, actor } = input;
        if (!Number.isInteger(guestCount) || guestCount < 1) {
            throw new Error("Guest count must be a positive whole number");
        }
        const session = await mongoose_1.default.startSession();
        try {
            let seated = null;
            await session.withTransaction(async () => {
                const table = (await Table_1.default.findById(tableId).session(session));
                if (!table)
                    throw new Error("Table not found");
                if (table.status === "dirty") {
                    throw new Error("Table must be bussed before it can seat guests");
                }
                const order = await Order_1.default.findById(orderId).session(session);
                if (!order)
                    throw new Error("Order not found");
                const group = (await Table_1.default.find({
                    tableNumber: { $in: [table.tableNumber, ...table.joinedWith] },
                }).session(session));
                const capacity = unionCapacity(table, group);
                if (guestCount > capacity) {
                    throw new Error(`Party of ${guestCount} exceeds table capacity of ${capacity}`);
                }
                const before = table.toObject();
                table.status = "occupied";
                table.currentOrderId = order._id;
                table.currentGuestCount = guestCount;
                table.vacantSince = null;
                table.reservationTime = null;
                await table.save({ session });
                await (0, audit_1.writeAudit)({
                    userId: actor.id,
                    userRole: actor.role,
                    action: "SEAT_GUESTS",
                    targetType: "Table",
                    targetId: table._id,
                    diff: { before, after: table.toObject() },
                    metadata: { orderId, guestCount },
                }, session);
                seated = table.toObject();
            });
            return seated;
        }
        finally {
            await session.endSession();
        }
    }
}
exports.SeatGuestsUseCase = SeatGuestsUseCase;
class CheckoutTableUseCase {
    async execute(input) {
        const { orderId, tableId, actor } = input;
        if (!orderId && !tableId) {
            throw new Error("Either orderId or tableId is required");
        }
        const session = await mongoose_1.default.startSession();
        try {
            const result = [];
            await session.withTransaction(async () => {
                const anchor = (await Table_1.default.findOne(tableId ? { _id: tableId } : { currentOrderId: orderId }).session(session));
                if (!anchor)
                    return;
                const group = (await Table_1.default.find({
                    tableNumber: { $in: [anchor.tableNumber, ...anchor.joinedWith] },
                }).session(session));
                for (const table of group) {
                    if (table.status !== "occupied")
                        continue;
                    const before = table.toObject();
                    table.status = "dirty";
                    table.currentOrderId = null;
                    table.currentGuestCount = 0;
                    await table.save({ session });
                    await (0, audit_1.writeAudit)({
                        userId: actor.id,
                        userRole: actor.role,
                        action: "CHECKOUT_TABLE",
                        targetType: "Table",
                        targetId: table._id,
                        diff: { before, after: table.toObject() },
                        metadata: { orderId: orderId !== null && orderId !== void 0 ? orderId : null },
                    }, session);
                    result.push(table.toObject());
                }
            });
            return result;
        }
        finally {
            await session.endSession();
        }
    }
}
exports.CheckoutTableUseCase = CheckoutTableUseCase;
class BusTableUseCase {
    async execute(input) {
        const { tableId, actor } = input;
        const session = await mongoose_1.default.startSession();
        try {
            let bussed = null;
            await session.withTransaction(async () => {
                const table = (await Table_1.default.findById(tableId).session(session));
                if (!table)
                    throw new Error("Table not found");
                if (table.status !== "dirty") {
                    throw new Error(`Only dirty tables can be bussed (table is ${table.status})`);
                }
                const before = table.toObject();
                const partners = table.joinedWith;
                if (partners.length > 0) {
                    await Table_1.default.updateMany({ tableNumber: { $in: partners } }, { $pull: { joinedWith: table.tableNumber } }, { session });
                }
                table.status = "vacant";
                table.joinedWith = [];
                table.currentOrderId = null;
                table.currentGuestCount = 0;
                table.vacantSince = new Date();
                await table.save({ session });
                await (0, audit_1.writeAudit)({
                    userId: actor.id,
                    userRole: actor.role,
                    action: "BUS_TABLE",
                    targetType: "Table",
                    targetId: table._id,
                    diff: { before, after: table.toObject() },
                }, session);
                bussed = table.toObject();
            });
            return bussed;
        }
        finally {
            await session.endSession();
        }
    }
}
exports.BusTableUseCase = BusTableUseCase;
class JoinTablesUseCase {
    async execute(input) {
        var _a;
        const { actor } = input;
        const tableNumbers = [...new Set((_a = input.tableNumbers) !== null && _a !== void 0 ? _a : [])];
        if (tableNumbers.length < 2) {
            throw new Error("At least two distinct tables are required to join");
        }
        const session = await mongoose_1.default.startSession();
        try {
            const joined = [];
            await session.withTransaction(async () => {
                const tables = (await Table_1.default.find({
                    tableNumber: { $in: tableNumbers },
                }).session(session));
                if (tables.length !== tableNumbers.length) {
                    throw new Error("One or more tables were not found");
                }
                const sections = new Set(tables.map((t) => t.section));
                if (sections.size > 1) {
                    throw new Error("Tables must be in the same section to be joined");
                }
                const blocked = tables.find((t) => t.status !== "vacant");
                if (blocked) {
                    throw new Error(`Table ${blocked.tableNumber} is ${blocked.status}; only vacant tables can be joined`);
                }
                for (const table of tables) {
                    const before = table.toObject();
                    table.joinedWith = tableNumbers.filter((n) => n !== table.tableNumber);
                    await table.save({ session });
                    await (0, audit_1.writeAudit)({
                        userId: actor.id,
                        userRole: actor.role,
                        action: "JOIN_TABLES",
                        targetType: "Table",
                        targetId: table._id,
                        diff: { before, after: table.toObject() },
                        metadata: {
                            union: tableNumbers,
                            combinedCapacity: tables.reduce((s, t) => s + t.capacity, 0),
                        },
                    }, session);
                    joined.push(table.toObject());
                }
            });
            return joined;
        }
        finally {
            await session.endSession();
        }
    }
}
exports.JoinTablesUseCase = JoinTablesUseCase;
class SplitTablesUseCase {
    async execute(input) {
        const { tableNumber, actor } = input;
        const session = await mongoose_1.default.startSession();
        try {
            const split = [];
            await session.withTransaction(async () => {
                const anchor = (await Table_1.default.findOne({ tableNumber }).session(session));
                if (!anchor)
                    throw new Error("Table not found");
                if (anchor.joinedWith.length === 0) {
                    throw new Error(`Table ${tableNumber} is not part of a union`);
                }
                const union = [tableNumber, ...anchor.joinedWith];
                const tables = (await Table_1.default.find({
                    tableNumber: { $in: union },
                }).session(session));
                for (const table of tables) {
                    const before = table.toObject();
                    table.joinedWith = [];
                    table.status = "vacant";
                    table.currentOrderId = null;
                    table.currentGuestCount = 0;
                    table.vacantSince = new Date();
                    await table.save({ session });
                    await (0, audit_1.writeAudit)({
                        userId: actor.id,
                        userRole: actor.role,
                        action: "SPLIT_TABLES",
                        targetType: "Table",
                        targetId: table._id,
                        diff: { before, after: table.toObject() },
                        metadata: { union },
                    }, session);
                    split.push(table.toObject());
                }
            });
            return split;
        }
        finally {
            await session.endSession();
        }
    }
}
exports.SplitTablesUseCase = SplitTablesUseCase;
class FloorMapService {
    async getFloorMap() {
        const tables = (await Table_1.default.find()
            .sort({ section: 1, tableNumber: 1 })
            .lean());
        const orderIds = tables
            .map((t) => t.currentOrderId)
            .filter((id) => !!id);
        const orders = orderIds.length
            ? await Order_1.default.find({ _id: { $in: orderIds } })
                .select("status paymentStatus totalAmount amountPaid items")
                .lean()
            : [];
        const orderById = new Map(orders.map((o) => [String(o._id), o]));
        return tables.map((t) => {
            var _a, _b, _c, _d, _e;
            const order = t.currentOrderId
                ? orderById.get(String(t.currentOrderId))
                : undefined;
            return {
                _id: String(t._id),
                tableNumber: t.tableNumber,
                capacity: t.capacity,
                section: t.section,
                status: t.status,
                currentGuestCount: t.currentGuestCount,
                joinedWith: t.joinedWith,
                reservationTime: (_a = t.reservationTime) !== null && _a !== void 0 ? _a : null,
                vacantSince: (_b = t.vacantSince) !== null && _b !== void 0 ? _b : null,
                activeOrder: order
                    ? {
                        _id: String(order._id),
                        status: order.status,
                        paymentStatus: order.paymentStatus,
                        totalAmount: order.totalAmount,
                        amountPaid: (_c = order.amountPaid) !== null && _c !== void 0 ? _c : 0,
                        itemCount: (_e = (_d = order.items) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0,
                    }
                    : null,
            };
        });
    }
}
exports.FloorMapService = FloorMapService;
exports.autoAllocationService = new AutoAllocationService();
exports.seatGuestsUseCase = new SeatGuestsUseCase();
exports.checkoutTableUseCase = new CheckoutTableUseCase();
exports.busTableUseCase = new BusTableUseCase();
exports.joinTablesUseCase = new JoinTablesUseCase();
exports.splitTablesUseCase = new SplitTablesUseCase();
exports.floorMapService = new FloorMapService();
//# sourceMappingURL=table_management_service.js.map