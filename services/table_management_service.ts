import mongoose, { ClientSession, Types } from "mongoose";
import Table, { ITable, TableSection } from "../models/Table";
import TableReservation from "../models/TableReservation";
import Order from "../models/Order";
import { writeAudit } from "./audit";
import { Actor } from "./restaurant_p2_features";

const RESERVATION_LOOKAHEAD_MS = 2 * 60 * 60 * 1000;

type TableDoc = ITable & { _id: Types.ObjectId };

function unionCapacity(table: TableDoc, group: TableDoc[]): number {
  const members = group.filter(
    (t) =>
      t.tableNumber === table.tableNumber ||
      table.joinedWith.includes(t.tableNumber),
  );
  return members.reduce((sum, t) => sum + t.capacity, 0) || table.capacity;
}

async function reservedTableIdsWithin(
  candidateIds: Types.ObjectId[],
  session: ClientSession,
  now: Date,
): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set();
  const horizon = new Date(now.getTime() + RESERVATION_LOOKAHEAD_MS);
  const reservations = await TableReservation.find({
    tableId: { $in: candidateIds },
    status: "pending",
    reservedFor: { $gte: now, $lte: horizon },
  })
    .select("tableId")
    .session(session)
    .lean();
  return new Set(reservations.map((r) => String(r.tableId)));
}

// ---------------------------------------------------------------------------
// A. Auto allocation
// ---------------------------------------------------------------------------

export interface AllocationInput {
  partySize: number;
  section?: TableSection;
  actor: Actor;
}

export class AutoAllocationService {
  async findAndAssignTable(input: AllocationInput): Promise<ITable> {
    const { partySize, section, actor } = input;
    if (!Number.isInteger(partySize) || partySize < 1) {
      throw new Error("Party size must be a positive whole number");
    }

    const session = await mongoose.startSession();
    try {
      let assigned: ITable | null = null;

      await session.withTransaction(async () => {
        const now = new Date();
        const sectionFilter = section ? { section } : {};

        const vacant = (await Table.find({
          status: "vacant",
          ...sectionFilter,
        })
          .sort({ capacity: 1, vacantSince: 1 })
          .session(session)) as unknown as TableDoc[];

        const reserved = await reservedTableIdsWithin(
          vacant.map((t) => t._id),
          session,
          now,
        );
        const seatable = vacant.filter((t) => !reserved.has(String(t._id)));

        // Smallest table that fits a whole party — sorted ascending, so the
        // first match maximizes layout efficiency; ties already break on the
        // longest-idle table (vacantSince ascending).
        const single = seatable.find((t) => t.capacity >= partySize);
        if (single) {
          single.status = "occupied";
          single.currentGuestCount = partySize;
          single.vacantSince = null;
          single.reservationTime = null;
          await single.save({ session });
          await writeAudit(
            {
              userId: actor.id,
              userRole: actor.role,
              action: "AUTO_ASSIGN_TABLE",
              targetType: "Table",
              targetId: single._id,
              metadata: { partySize, mode: "single", section: single.section },
            },
            session,
          );
          assigned = single.toObject();
          return;
        }

        // No single table fits: combine adjacent vacant tables in one section.
        const combineSection =
          section ?? this.bestCombineSection(seatable, partySize);
        const pool = seatable
          .filter((t) => t.section === combineSection)
          .sort((a, b) => b.capacity - a.capacity);

        const group: TableDoc[] = [];
        let combinedCapacity = 0;
        for (const table of pool) {
          group.push(table);
          combinedCapacity += table.capacity;
          if (combinedCapacity >= partySize) break;
        }

        if (group.length < 2 || combinedCapacity < partySize) {
          throw new Error(
            await this.explainFailure(partySize, section, session),
          );
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

        await writeAudit(
          {
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
          },
          session,
        );

        assigned = primary.toObject();
      });

      return assigned as unknown as ITable;
    } finally {
      await session.endSession();
    }
  }

  private bestCombineSection(
    seatable: TableDoc[],
    partySize: number,
  ): TableSection {
    const bySection = new Map<TableSection, number>();
    for (const t of seatable) {
      bySection.set(t.section, (bySection.get(t.section) ?? 0) + t.capacity);
    }
    let best: TableSection | null = null;
    let bestCapacity = -1;
    for (const [sec, cap] of bySection) {
      if (cap >= partySize && (best === null || cap < bestCapacity)) {
        best = sec;
        bestCapacity = cap;
      }
    }
    // Fall back to the section with the most capacity so the failure message is
    // computed against the most promising zone.
    if (best) return best;
    return [...bySection.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "indoor";
  }

  private async explainFailure(
    partySize: number,
    section: TableSection | undefined,
    session: ClientSession,
  ): Promise<string> {
    const sectionFilter = section ? { section } : {};
    const dirty = await Table.countDocuments({
      status: "dirty",
      ...sectionFilter,
    }).session(session);
    const reserved = await Table.countDocuments({
      status: "reserved",
      ...sectionFilter,
    }).session(session);
    const where = section ? ` in section "${section}"` : "";
    return (
      `No vacant tables matching a party of ${partySize}${where}. ` +
      `${dirty} dirty table(s) await bussing, ${reserved} reserved.`
    );
  }
}

// ---------------------------------------------------------------------------
// B. Seating & order-flow sync
// ---------------------------------------------------------------------------

export interface SeatGuestsInput {
  tableId: string;
  orderId: string;
  guestCount: number;
  actor: Actor;
}

export class SeatGuestsUseCase {
  async execute(input: SeatGuestsInput): Promise<ITable> {
    const { tableId, orderId, guestCount, actor } = input;
    if (!Number.isInteger(guestCount) || guestCount < 1) {
      throw new Error("Guest count must be a positive whole number");
    }

    const session = await mongoose.startSession();
    try {
      let seated: ITable | null = null;

      await session.withTransaction(async () => {
        const table = (await Table.findById(tableId).session(
          session,
        )) as TableDoc | null;
        if (!table) throw new Error("Table not found");
        if (table.status === "dirty") {
          throw new Error("Table must be bussed before it can seat guests");
        }

        const order = await Order.findById(orderId).session(session);
        if (!order) throw new Error("Order not found");

        const group = (await Table.find({
          tableNumber: { $in: [table.tableNumber, ...table.joinedWith] },
        }).session(session)) as unknown as TableDoc[];
        const capacity = unionCapacity(table, group);
        if (guestCount > capacity) {
          throw new Error(
            `Party of ${guestCount} exceeds table capacity of ${capacity}`,
          );
        }

        const before = table.toObject();
        table.status = "occupied";
        table.currentOrderId = order._id as Types.ObjectId;
        table.currentGuestCount = guestCount;
        table.vacantSince = null;
        table.reservationTime = null;
        await table.save({ session });

        await writeAudit(
          {
            userId: actor.id,
            userRole: actor.role,
            action: "SEAT_GUESTS",
            targetType: "Table",
            targetId: table._id,
            diff: { before, after: table.toObject() },
            metadata: { orderId, guestCount },
          },
          session,
        );

        seated = table.toObject();
      });

      return seated as unknown as ITable;
    } finally {
      await session.endSession();
    }
  }
}

export interface CheckoutTableInput {
  orderId?: string;
  tableId?: string;
  actor: Actor;
}

export class CheckoutTableUseCase {
  // Returns the affected tables (empty when the order has no dine-in table),
  // so the payment flow can call it unconditionally without throwing.
  async execute(input: CheckoutTableInput): Promise<ITable[]> {
    const { orderId, tableId, actor } = input;
    if (!orderId && !tableId) {
      throw new Error("Either orderId or tableId is required");
    }

    const session = await mongoose.startSession();
    try {
      const result: ITable[] = [];

      await session.withTransaction(async () => {
        const anchor = (await Table.findOne(
          tableId ? { _id: tableId } : { currentOrderId: orderId },
        ).session(session)) as TableDoc | null;
        if (!anchor) return;

        const group = (await Table.find({
          tableNumber: { $in: [anchor.tableNumber, ...anchor.joinedWith] },
        }).session(session)) as unknown as TableDoc[];

        for (const table of group) {
          if (table.status !== "occupied") continue;
          const before = table.toObject();
          table.status = "dirty";
          table.currentOrderId = null;
          table.currentGuestCount = 0;
          await table.save({ session });

          await writeAudit(
            {
              userId: actor.id,
              userRole: actor.role,
              action: "CHECKOUT_TABLE",
              targetType: "Table",
              targetId: table._id,
              diff: { before, after: table.toObject() },
              metadata: { orderId: orderId ?? null },
            },
            session,
          );
          result.push(table.toObject());
        }
      });

      return result;
    } finally {
      await session.endSession();
    }
  }
}

export interface BusTableInput {
  tableId: string;
  actor: Actor;
}

export class BusTableUseCase {
  async execute(input: BusTableInput): Promise<ITable> {
    const { tableId, actor } = input;
    const session = await mongoose.startSession();
    try {
      let bussed: ITable | null = null;

      await session.withTransaction(async () => {
        const table = (await Table.findById(tableId).session(
          session,
        )) as TableDoc | null;
        if (!table) throw new Error("Table not found");
        if (table.status !== "dirty") {
          throw new Error(`Only dirty tables can be bussed (table is ${table.status})`);
        }

        const before = table.toObject();
        const partners = table.joinedWith;

        // Bussing dissolves any union: remove this table from its partners.
        if (partners.length > 0) {
          await Table.updateMany(
            { tableNumber: { $in: partners } },
            { $pull: { joinedWith: table.tableNumber } },
            { session },
          );
        }

        table.status = "vacant";
        table.joinedWith = [];
        table.currentOrderId = null;
        table.currentGuestCount = 0;
        table.vacantSince = new Date();
        await table.save({ session });

        await writeAudit(
          {
            userId: actor.id,
            userRole: actor.role,
            action: "BUS_TABLE",
            targetType: "Table",
            targetId: table._id,
            diff: { before, after: table.toObject() },
          },
          session,
        );

        bussed = table.toObject();
      });

      return bussed as unknown as ITable;
    } finally {
      await session.endSession();
    }
  }
}

// ---------------------------------------------------------------------------
// C. Advanced operations — join / split
// ---------------------------------------------------------------------------

export interface JoinTablesInput {
  tableNumbers: string[];
  actor: Actor;
}

export class JoinTablesUseCase {
  async execute(input: JoinTablesInput): Promise<ITable[]> {
    const { actor } = input;
    const tableNumbers = [...new Set(input.tableNumbers ?? [])];
    if (tableNumbers.length < 2) {
      throw new Error("At least two distinct tables are required to join");
    }

    const session = await mongoose.startSession();
    try {
      const joined: ITable[] = [];

      await session.withTransaction(async () => {
        const tables = (await Table.find({
          tableNumber: { $in: tableNumbers },
        }).session(session)) as unknown as TableDoc[];

        if (tables.length !== tableNumbers.length) {
          throw new Error("One or more tables were not found");
        }
        const sections = new Set(tables.map((t) => t.section));
        if (sections.size > 1) {
          throw new Error("Tables must be in the same section to be joined");
        }
        const blocked = tables.find((t) => t.status !== "vacant");
        if (blocked) {
          throw new Error(
            `Table ${blocked.tableNumber} is ${blocked.status}; only vacant tables can be joined`,
          );
        }

        for (const table of tables) {
          const before = table.toObject();
          table.joinedWith = tableNumbers.filter((n) => n !== table.tableNumber);
          await table.save({ session });
          await writeAudit(
            {
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
            },
            session,
          );
          joined.push(table.toObject());
        }
      });

      return joined;
    } finally {
      await session.endSession();
    }
  }
}

export interface SplitTablesInput {
  tableNumber: string;
  actor: Actor;
}

export class SplitTablesUseCase {
  async execute(input: SplitTablesInput): Promise<ITable[]> {
    const { tableNumber, actor } = input;
    const session = await mongoose.startSession();
    try {
      const split: ITable[] = [];

      await session.withTransaction(async () => {
        const anchor = (await Table.findOne({ tableNumber }).session(
          session,
        )) as TableDoc | null;
        if (!anchor) throw new Error("Table not found");
        if (anchor.joinedWith.length === 0) {
          throw new Error(`Table ${tableNumber} is not part of a union`);
        }

        const union = [tableNumber, ...anchor.joinedWith];
        const tables = (await Table.find({
          tableNumber: { $in: union },
        }).session(session)) as unknown as TableDoc[];

        for (const table of tables) {
          const before = table.toObject();
          table.joinedWith = [];
          table.status = "vacant";
          table.currentOrderId = null;
          table.currentGuestCount = 0;
          table.vacantSince = new Date();
          await table.save({ session });
          await writeAudit(
            {
              userId: actor.id,
              userRole: actor.role,
              action: "SPLIT_TABLES",
              targetType: "Table",
              targetId: table._id,
              diff: { before, after: table.toObject() },
              metadata: { union },
            },
            session,
          );
          split.push(table.toObject());
        }
      });

      return split;
    } finally {
      await session.endSession();
    }
  }
}

// ---------------------------------------------------------------------------
// D. Live floor map (read model for waiter iPads)
// ---------------------------------------------------------------------------

export interface FloorMapTable {
  _id: string;
  tableNumber: string;
  capacity: number;
  section: TableSection;
  status: string;
  currentGuestCount: number;
  joinedWith: string[];
  reservationTime: Date | null;
  vacantSince: Date | null;
  activeOrder: {
    _id: string;
    status: string;
    paymentStatus: string;
    totalAmount: number;
    amountPaid: number;
    itemCount: number;
  } | null;
}

export class FloorMapService {
  async getFloorMap(): Promise<FloorMapTable[]> {
    const tables = (await Table.find()
      .sort({ section: 1, tableNumber: 1 })
      .lean()) as unknown as (TableDoc & { _id: Types.ObjectId })[];

    const orderIds = tables
      .map((t) => t.currentOrderId)
      .filter((id): id is Types.ObjectId => !!id);

    const orders = orderIds.length
      ? await Order.find({ _id: { $in: orderIds } })
          .select("status paymentStatus totalAmount amountPaid items")
          .lean()
      : [];
    const orderById = new Map(orders.map((o) => [String(o._id), o]));

    return tables.map((t) => {
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
        reservationTime: t.reservationTime ?? null,
        vacantSince: t.vacantSince ?? null,
        activeOrder: order
          ? {
              _id: String(order._id),
              status: order.status,
              paymentStatus: order.paymentStatus,
              totalAmount: order.totalAmount,
              amountPaid: order.amountPaid ?? 0,
              itemCount: order.items?.length ?? 0,
            }
          : null,
      };
    });
  }
}

export const autoAllocationService = new AutoAllocationService();
export const seatGuestsUseCase = new SeatGuestsUseCase();
export const checkoutTableUseCase = new CheckoutTableUseCase();
export const busTableUseCase = new BusTableUseCase();
export const joinTablesUseCase = new JoinTablesUseCase();
export const splitTablesUseCase = new SplitTablesUseCase();
export const floorMapService = new FloorMapService();
