import { Router, Request, Response } from "express";
import { tableOccupancyService } from "../../services/TableOccupancyService";

const router = Router();

/**
 * GET /api/tables/occupancy-summary
 * Get overall table occupancy summary
 */
router.get(
  "/api/tables/occupancy-summary",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const maxTables = parseInt(req.query.maxTables as string) || 50;
      const summary =
        await tableOccupancyService.getTableOccupancySummary(maxTables);

      res.json({
        message: "Table occupancy summary retrieved successfully",
        data: summary,
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error fetching table occupancy summary",
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/tables/occupied
 * Get list of occupied tables
 */
router.get(
  "/api/tables/occupied",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const occupiedTables = await tableOccupancyService.getOccupiedTables();

      res.json({
        message: "Occupied tables retrieved successfully",
        occupiedTables,
        count: occupiedTables.length,
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error fetching occupied tables",
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/tables/available
 * Get list of available tables
 */
router.get(
  "/api/tables/available",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const maxTables = parseInt(req.query.maxTables as string) || 50;
      const availableTables =
        await tableOccupancyService.getAvailableTables(maxTables);

      res.json({
        message: "Available tables retrieved successfully",
        availableTables,
        count: availableTables.length,
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error fetching available tables",
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/tables/status
 * Get detailed status of all tables
 */
router.get(
  "/api/tables/status",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const maxTables = parseInt(req.query.maxTables as string) || 50;
      const tableStatus =
        await tableOccupancyService.getDetailedTableStatus(maxTables);

      res.json({
        message: "Detailed table status retrieved successfully",
        data: tableStatus,
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error fetching table status",
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/tables/:tableNumber
 * Get occupancy status of specific table
 */
router.get(
  "/api/tables/:tableNumber",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tableNumber } = req.params as Record<string, string>;
      const tableNum = parseInt(tableNumber);

      if (isNaN(tableNum)) {
        res.status(400).json({
          message: "Invalid table number",
        });
        return;
      }

      const isOccupied = await tableOccupancyService.isTableOccupied(tableNum);
      const order = await tableOccupancyService.getTableOrder(tableNum);

      res.json({
        tableNumber: tableNum,
        isOccupied,
        status: isOccupied ? "occupied" : "available",
        activeOrder: order || null,
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error checking table occupancy",
        error: error.message,
      });
    }
  },
);

/**
 * POST /api/tables/:tableNumber/release
 * Release a table (mark order as served)
 */
router.post(
  "/api/tables/:tableNumber/release",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tableNumber } = req.params as Record<string, string>;
      const tableNum = parseInt(tableNumber);

      if (isNaN(tableNum)) {
        res.status(400).json({
          message: "Invalid table number",
        });
        return;
      }

      const order = await tableOccupancyService.releaseTable(tableNum);

      res.json({
        message: `Table ${tableNum} released successfully`,
        order,
      });
    } catch (error: any) {
      res.status(404).json({
        message: "Error releasing table",
        error: error.message,
      });
    }
  },
);

/**
 * GET /api/tables/:tableNumber/order
 * Get current order for a specific table
 */
router.get(
  "/api/tables/:tableNumber/order",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tableNumber } = req.params as Record<string, string>;
      const tableNum = parseInt(tableNumber);

      if (isNaN(tableNum)) {
        res.status(400).json({
          message: "Invalid table number",
        });
        return;
      }

      const order = await tableOccupancyService.getTableOrder(tableNum);

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
    } catch (error: any) {
      res.status(500).json({
        message: "Error fetching table order",
        error: error.message,
      });
    }
  },
);

export default router;
