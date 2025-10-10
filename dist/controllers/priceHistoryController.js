"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPriceHistoryById = exports.getAllPriceHistories = void 0;
const PriceHistory_1 = __importDefault(require("../models/PriceHistory"));
const mongoose_1 = require("mongoose");
const getAllPriceHistories = async (req, res) => {
    try {
        const { menuItem, oldPrice, newPrice, changedBy, dateFrom, dateTo, specificDate, } = req.query;
        const filter = {};
        if (menuItem && mongoose_1.Types.ObjectId.isValid(menuItem)) {
            filter.menuItem = new mongoose_1.Types.ObjectId(menuItem);
        }
        if (changedBy && mongoose_1.Types.ObjectId.isValid(changedBy)) {
            filter.changedBy = new mongoose_1.Types.ObjectId(changedBy);
        }
        if (oldPrice)
            filter.oldPrice = Number(oldPrice);
        if (newPrice)
            filter.newPrice = Number(newPrice);
        if (dateFrom || dateTo) {
            filter.changeDate = {};
            if (dateFrom) {
                filter.changeDate.$gte = new Date(dateFrom);
            }
            if (dateTo) {
                filter.changeDate.$lte = new Date(dateTo);
            }
        }
        else if (specificDate) {
            const queryDate = new Date(specificDate);
            const startOfDay = new Date(queryDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(queryDate);
            endOfDay.setHours(23, 59, 59, 999);
            filter.changeDate = {
                $gte: startOfDay,
                $lte: endOfDay,
            };
        }
        const priceHistory = await PriceHistory_1.default.find(filter)
            .populate("menuItem", "name price category")
            .populate("changedBy", "name email");
        res.json({
            success: true,
            data: priceHistory,
            count: priceHistory.length,
        });
    }
    catch (error) {
        console.error("Server Error", error);
        res.status(500).json({
            success: false,
            message: "server error",
            error: process.env.NODE_ENV === "development" ? error : {},
        });
    }
};
exports.getAllPriceHistories = getAllPriceHistories;
const getPriceHistoryById = async (req, res) => {
    try {
        if (!mongoose_1.Types.ObjectId.isValid(req.params.id)) {
            res.status(400).json({
                success: false,
                message: "Invalid Price History ID Format",
            });
            return;
        }
        const priceHistory = await PriceHistory_1.default.findById(req.params.id)
            .populate("menuItem", "name price category description")
            .populate("changedBy", "name email");
        if (!priceHistory) {
            res.status(404).json({
                success: false,
                message: "Price History not found",
            });
            return;
        }
        res.json({
            success: true,
            data: priceHistory,
        });
    }
    catch (error) {
        console.error("Error in getPriceHistoryById:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: process.env.NODE_ENV === "development" ? error : {},
        });
    }
};
exports.getPriceHistoryById = getPriceHistoryById;
//# sourceMappingURL=priceHistoryController.js.map