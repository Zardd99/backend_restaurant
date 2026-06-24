"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const TableOccupancyService_1 = require("../../services/TableOccupancyService");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get("/api/tables/occupancy-summary", (0, auth_1.requirePermission)("table:read"), async (req, res) => {
    try {
        const maxTables = parseInt(req.query.maxTables) || 50;
        const summary = await TableOccupancyService_1.tableOccupancyService.getTableOccupancySummary(maxTables);
        res.json({
            message: "Table occupancy summary retrieved successfully",
            data: summary,
        });
    }
    catch (error) {
        res.status(500).json({
            message: "Error fetching table occupancy summary",
            error: error.message,
        });
    }
});
router.get("/api/tables/occupied", (0, auth_1.requirePermission)("table:read"), async (req, res) => {
    try {
        const occupiedTables = await TableOccupancyService_1.tableOccupancyService.getOccupiedTables();
        res.json({
            message: "Occupied tables retrieved successfully",
            occupiedTables,
            count: occupiedTables.length,
        });
    }
    catch (error) {
        res.status(500).json({
            message: "Error fetching occupied tables",
            error: error.message,
        });
    }
});
router.get("/api/tables/available", (0, auth_1.requirePermission)("table:read"), async (req, res) => {
    try {
        const maxTables = parseInt(req.query.maxTables) || 50;
        const availableTables = await TableOccupancyService_1.tableOccupancyService.getAvailableTables(maxTables);
        res.json({
            message: "Available tables retrieved successfully",
            availableTables,
            count: availableTables.length,
        });
    }
    catch (error) {
        res.status(500).json({
            message: "Error fetching available tables",
            error: error.message,
        });
    }
});
router.get("/api/tables/status", (0, auth_1.requirePermission)("table:read"), async (req, res) => {
    try {
        const maxTables = parseInt(req.query.maxTables) || 50;
        const tableStatus = await TableOccupancyService_1.tableOccupancyService.getDetailedTableStatus(maxTables);
        res.json({
            message: "Detailed table status retrieved successfully",
            data: tableStatus,
        });
    }
    catch (error) {
        res.status(500).json({
            message: "Error fetching table status",
            error: error.message,
        });
    }
});
router.get("/api/tables/:tableNumber", (0, auth_1.requirePermission)("table:read"), async (req, res) => {
    try {
        const { tableNumber } = req.params;
        const tableNum = parseInt(tableNumber);
        if (isNaN(tableNum)) {
            res.status(400).json({
                message: "Invalid table number",
            });
            return;
        }
        const isOccupied = await TableOccupancyService_1.tableOccupancyService.isTableOccupied(tableNum);
        const order = await TableOccupancyService_1.tableOccupancyService.getTableOrder(tableNum);
        res.json({
            tableNumber: tableNum,
            isOccupied,
            status: isOccupied ? "occupied" : "available",
            activeOrder: order || null,
        });
    }
    catch (error) {
        res.status(500).json({
            message: "Error checking table occupancy",
            error: error.message,
        });
    }
});
router.post("/api/tables/:tableNumber/release", (0, auth_1.requirePermission)("table:manage"), async (req, res) => {
    try {
        const { tableNumber } = req.params;
        const tableNum = parseInt(tableNumber);
        if (isNaN(tableNum)) {
            res.status(400).json({
                message: "Invalid table number",
            });
            return;
        }
        const order = await TableOccupancyService_1.tableOccupancyService.releaseTable(tableNum);
        res.json({
            message: `Table ${tableNum} released successfully`,
            order,
        });
    }
    catch (error) {
        res.status(404).json({
            message: "Error releasing table",
            error: error.message,
        });
    }
});
router.get("/api/tables/:tableNumber/order", (0, auth_1.requirePermission)("table:read"), async (req, res) => {
    try {
        const { tableNumber } = req.params;
        const tableNum = parseInt(tableNumber);
        if (isNaN(tableNum)) {
            res.status(400).json({
                message: "Invalid table number",
            });
            return;
        }
        const order = await TableOccupancyService_1.tableOccupancyService.getTableOrder(tableNum);
        if (!order) {
            res.status(404).json({
                message: `No active order found for table ${tableNum}`,
            });
            return;
        }
        res.json({
            message: "Order retrieved successfully",
            order,
        });
    }
    catch (error) {
        res.status(500).json({
            message: "Error fetching table order",
            error: error.message,
        });
    }
});
exports.default = router;
//# sourceMappingURL=tables-router.js.map