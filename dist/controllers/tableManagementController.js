"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFloorMap = exports.splitTables = exports.joinTables = exports.busTable = exports.seatGuests = exports.autoAssignTable = void 0;
const Table_1 = require("../models/Table");
const table_management_service_1 = require("../services/table_management_service");
const actorOf = (req) => ({
    id: String(req.user._id),
    role: req.user.role,
});
const isSection = (value) => typeof value === "string" && Table_1.TABLE_SECTIONS.includes(value);
const autoAssignTable = async (req, res) => {
    var _a;
    try {
        const partySize = Number((_a = req.body.partySize) !== null && _a !== void 0 ? _a : req.body.guestCount);
        const section = req.body.section;
        if (section !== undefined && !isSection(section)) {
            res.status(400).json({
                error: `section must be one of: ${Table_1.TABLE_SECTIONS.join(", ")}`,
            });
            return;
        }
        const table = await table_management_service_1.autoAllocationService.findAndAssignTable({
            partySize,
            section: section,
            actor: actorOf(req),
        });
        res.json({ message: "Table assigned", table });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
};
exports.autoAssignTable = autoAssignTable;
const seatGuests = async (req, res) => {
    try {
        const table = await table_management_service_1.seatGuestsUseCase.execute({
            tableId: req.params.id,
            orderId: String(req.body.orderId),
            guestCount: Number(req.body.guestCount),
            actor: actorOf(req),
        });
        res.json({ message: "Guests seated", table });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
};
exports.seatGuests = seatGuests;
const busTable = async (req, res) => {
    try {
        const table = await table_management_service_1.busTableUseCase.execute({
            tableId: req.params.id,
            actor: actorOf(req),
        });
        res.json({ message: "Table cleaned and ready", table });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
};
exports.busTable = busTable;
const joinTables = async (req, res) => {
    var _a;
    try {
        const tables = await table_management_service_1.joinTablesUseCase.execute({
            tableNumbers: ((_a = req.body.tableNumbers) !== null && _a !== void 0 ? _a : []).map(String),
            actor: actorOf(req),
        });
        res.json({ message: "Tables joined", tables });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
};
exports.joinTables = joinTables;
const splitTables = async (req, res) => {
    try {
        const tables = await table_management_service_1.splitTablesUseCase.execute({
            tableNumber: String(req.body.tableNumber),
            actor: actorOf(req),
        });
        res.json({ message: "Tables split", tables });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
};
exports.splitTables = splitTables;
const getFloorMap = async (_req, res) => {
    try {
        const floor = await table_management_service_1.floorMapService.getFloorMap();
        res.json({ message: "Floor map retrieved", data: floor });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
};
exports.getFloorMap = getFloorMap;
//# sourceMappingURL=tableManagementController.js.map