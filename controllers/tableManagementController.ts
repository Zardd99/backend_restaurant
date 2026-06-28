import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { TABLE_SECTIONS, TableSection } from "../models/Table";
import {
  autoAllocationService,
  seatGuestsUseCase,
  busTableUseCase,
  joinTablesUseCase,
  splitTablesUseCase,
  floorMapService,
} from "../services/table_management_service";

const actorOf = (req: AuthRequest) => ({
  id: String(req.user!._id),
  role: req.user!.role,
});

const isSection = (value: unknown): value is TableSection =>
  typeof value === "string" && (TABLE_SECTIONS as readonly string[]).includes(value);

export const autoAssignTable = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const partySize = Number(req.body.partySize ?? req.body.guestCount);
    const section = req.body.section;
    if (section !== undefined && !isSection(section)) {
      res.status(400).json({
        error: `section must be one of: ${TABLE_SECTIONS.join(", ")}`,
      });
      return;
    }

    const table = await autoAllocationService.findAndAssignTable({
      partySize,
      section: section as TableSection | undefined,
      actor: actorOf(req),
    });

    res.json({ message: "Table assigned", table });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
};

export const seatGuests = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const table = await seatGuestsUseCase.execute({
      tableId: req.params.id as string,
      orderId: String(req.body.orderId),
      guestCount: Number(req.body.guestCount),
      actor: actorOf(req),
    });
    res.json({ message: "Guests seated", table });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
};

export const busTable = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const table = await busTableUseCase.execute({
      tableId: req.params.id as string,
      actor: actorOf(req),
    });
    res.json({ message: "Table cleaned and ready", table });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
};

export const joinTables = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const tables = await joinTablesUseCase.execute({
      tableNumbers: (req.body.tableNumbers ?? []).map(String),
      actor: actorOf(req),
    });
    res.json({ message: "Tables joined", tables });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
};

export const splitTables = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const tables = await splitTablesUseCase.execute({
      tableNumber: String(req.body.tableNumber),
      actor: actorOf(req),
    });
    res.json({ message: "Tables split", tables });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
};

export const getFloorMap = async (
  _req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const floor = await floorMapService.getFloorMap();
    res.json({ message: "Floor map retrieved", data: floor });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};
