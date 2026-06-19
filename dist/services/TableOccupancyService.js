"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tableOccupancyService = void 0;
const Order_1 = __importDefault(require("../models/Order"));
class TableOccupancyService {
    async isTableOccupied(tableNumber) {
        try {
            const activeOrder = await Order_1.default.findOne({
                tableNumber,
                status: { $in: ["pending", "confirmed", "preparing", "ready"] },
            });
            return !!activeOrder;
        }
        catch (error) {
            console.error(`Error checking table ${tableNumber} occupancy:`, error);
            throw error;
        }
    }
    async getOccupiedTables() {
        try {
            const occupiedTables = await Order_1.default.aggregate([
                {
                    $match: {
                        tableNumber: { $exists: true, $ne: null },
                        status: { $in: ["pending", "confirmed", "preparing", "ready"] },
                    },
                },
                {
                    $group: {
                        _id: "$tableNumber",
                    },
                },
                {
                    $sort: { _id: 1 },
                },
                {
                    $project: {
                        tableNumber: "$_id",
                        _id: 0,
                    },
                },
            ]);
            return occupiedTables.map((t) => t.tableNumber);
        }
        catch (error) {
            console.error("Error fetching occupied tables:", error);
            throw error;
        }
    }
    async getAvailableTables(maxTableNumber = 50) {
        try {
            const occupiedTables = await this.getOccupiedTables();
            const availableTables = [];
            for (let i = 1; i <= maxTableNumber; i++) {
                if (!occupiedTables.includes(i)) {
                    availableTables.push(i);
                }
            }
            return availableTables;
        }
        catch (error) {
            console.error("Error fetching available tables:", error);
            throw error;
        }
    }
    async getTableOrder(tableNumber) {
        try {
            const order = await Order_1.default.findOne({
                tableNumber,
                status: { $in: ["pending", "confirmed", "preparing", "ready"] },
            }).select("-__v");
            return order;
        }
        catch (error) {
            console.error(`Error fetching order for table ${tableNumber}:`, error);
            throw error;
        }
    }
    async getTableOccupancySummary(maxTableNumber = 50) {
        try {
            const occupiedTables = await this.getOccupiedTables();
            const availableTables = await this.getAvailableTables(maxTableNumber);
            return {
                totalTables: maxTableNumber,
                occupiedCount: occupiedTables.length,
                availableCount: availableTables.length,
                occupiedTables: occupiedTables.sort((a, b) => a - b),
                availableTables: availableTables.sort((a, b) => a - b),
                occupancyRate: Math.round((occupiedTables.length / maxTableNumber) * 100),
            };
        }
        catch (error) {
            console.error("Error generating table occupancy summary:", error);
            throw error;
        }
    }
    async releaseTable(tableNumber) {
        try {
            const order = await Order_1.default.findOneAndUpdate({
                tableNumber,
                status: { $in: ["pending", "confirmed", "preparing", "ready"] },
            }, { status: "served" }, { new: true });
            if (!order) {
                throw new Error(`No active order found for table ${tableNumber}`);
            }
            console.log(`Table ${tableNumber} released successfully`);
            return order;
        }
        catch (error) {
            console.error(`Error releasing table ${tableNumber}:`, error);
            throw error;
        }
    }
    async getDetailedTableStatus(maxTableNumber = 50) {
        try {
            const tableStatuses = [];
            const activeOrders = await Order_1.default.find({
                status: { $in: ["pending", "confirmed", "preparing", "ready"] },
                tableNumber: { $exists: true, $ne: null },
            }).select("tableNumber status customerName items totalAmount createdAt");
            const occupiedMap = new Map();
            activeOrders.forEach((order) => {
                var _a;
                occupiedMap.set(order.tableNumber, {
                    orderId: order._id.toString(),
                    orderStatus: order.status,
                    customerName: order.customerName,
                    itemCount: ((_a = order.items) === null || _a === void 0 ? void 0 : _a.length) || 0,
                    totalAmount: order.totalAmount,
                    createdAt: order.createdAt,
                });
            });
            for (let i = 1; i <= maxTableNumber; i++) {
                if (occupiedMap.has(i)) {
                    const orderInfo = occupiedMap.get(i);
                    tableStatuses.push(Object.assign({ tableNumber: i, status: "occupied" }, orderInfo));
                }
                else {
                    tableStatuses.push({
                        tableNumber: i,
                        status: "available",
                    });
                }
            }
            return tableStatuses;
        }
        catch (error) {
            console.error("Error generating detailed table status:", error);
            throw error;
        }
    }
}
exports.tableOccupancyService = new TableOccupancyService();
exports.default = TableOccupancyService;
//# sourceMappingURL=TableOccupancyService.js.map