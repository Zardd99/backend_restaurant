"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderStats = exports.updateOrderStatus = exports.deleteOrder = exports.updateOrder = exports.createOrder = exports.getOrderById = exports.getAllOrders = void 0;
const Order_1 = __importDefault(require("../models/Order"));
const getAllOrders = async (req, res) => {
    try {
        const { status, customer, orderType, startDate, endDate, minAmount, maxAmount, } = req.query;
        const filter = {};
        if (status)
            filter.status = status;
        if (customer)
            filter.customer = customer;
        if (orderType)
            filter.orderType = orderType;
        if (startDate || endDate) {
            filter.orderDate = {};
            if (startDate)
                filter.orderDate.$gte = new Date(startDate);
            if (endDate)
                filter.orderDate.$lte = new Date(endDate);
        }
        if (minAmount || maxAmount) {
            filter.totalAmount = {};
            if (minAmount)
                filter.totalAmount.$gte = Number(minAmount);
            if (maxAmount)
                filter.totalAmount.$lte = Number(maxAmount);
        }
        const orders = await Order_1.default.find(filter)
            .populate("customer", "name email")
            .populate("items.menuItem", "name price")
            .sort({ orderDate: -1 });
        res.json(orders);
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};
exports.getAllOrders = getAllOrders;
const getOrderById = async (req, res) => {
    try {
        const order = await Order_1.default.findById(req.params.id)
            .populate("customer", "name email phone")
            .populate("items.menuItem", "name price description");
        if (!order) {
            res.status(404).json({ message: "Order not found" });
            return;
        }
        res.json(order);
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};
exports.getOrderById = getOrderById;
const createOrder = async (req, res) => {
    try {
        console.log("Creating order with data:", req.body);
        const order = new Order_1.default(req.body);
        const savedOrder = await order.save();
        await savedOrder.populate([
            { path: "customer", select: "name email" },
            { path: "items.menuItem", select: "name price" },
        ]);
        res.status(201).json(savedOrder);
    }
    catch (error) {
        console.error("Error creating order:", error);
        res.status(400).json({
            message: "Error creating order",
            error: error instanceof Error ? error.message : String(error),
            details: error instanceof Error && "errors" in error ? error.errors : undefined,
        });
    }
};
exports.createOrder = createOrder;
const updateOrder = async (req, res) => {
    try {
        const order = await Order_1.default.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        })
            .populate("customer", "name email")
            .populate("items.menuItem", "name price");
        if (!order) {
            res.status(404).json({ message: "Order not found" });
            return;
        }
        res.json(order);
    }
    catch (error) {
        res.status(400).json({ message: "Error updating order", error });
    }
};
exports.updateOrder = updateOrder;
const deleteOrder = async (req, res) => {
    try {
        const order = await Order_1.default.findByIdAndDelete(req.params.id);
        if (!order) {
            res.status(404).json({ message: "Order not found" });
            return;
        }
        res.json({ message: "Order deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};
exports.deleteOrder = deleteOrder;
const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = [
            "pending",
            "confirmed",
            "preparing",
            "ready",
            "served",
            "cancelled",
        ];
        if (!validStatuses.includes(status)) {
            res.status(400).json({
                message: "Invalid status value",
                validStatuses,
            });
            return;
        }
        const order = await Order_1.default.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true })
            .populate("customer", "name email")
            .populate("items.menuItem", "name price");
        if (!order) {
            res.status(404).json({ message: "Order not found" });
            return;
        }
        res.json(order);
    }
    catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({
            message: "Error updating order status",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.updateOrderStatus = updateOrderStatus;
const getOrderStats = async (req, res) => {
    var _a, _b, _c;
    try {
        console.log("Fetching order statistics...");
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        console.log("Date ranges:", { startOfDay, weekAgo, startOfYear });
        const dailyEarnings = await Order_1.default.aggregate([
            {
                $match: {
                    orderDate: { $gte: startOfDay },
                    status: { $ne: "cancelled" },
                },
            },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]);
        console.log("Daily earnings result:", dailyEarnings);
        const weeklyEarnings = await Order_1.default.aggregate([
            {
                $match: {
                    orderDate: { $gte: weekAgo },
                    status: { $ne: "cancelled" },
                },
            },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]);
        console.log("Weekly earnings result:", weeklyEarnings);
        const yearlyEarnings = await Order_1.default.aggregate([
            {
                $match: {
                    orderDate: { $gte: startOfYear },
                    status: { $ne: "cancelled" },
                },
            },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]);
        console.log("Yearly earnings result:", yearlyEarnings);
        const bestSellingDishes = await Order_1.default.aggregate([
            { $match: { status: { $ne: "cancelled" } } },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.menuItem",
                    quantity: { $sum: "$items.quantity" },
                    revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
                },
            },
            { $sort: { quantity: -1 } },
            { $limit: 5 },
        ]);
        console.log("Best selling dishes result:", bestSellingDishes);
        res.json({
            dailyEarnings: ((_a = dailyEarnings[0]) === null || _a === void 0 ? void 0 : _a.total) || 0,
            weeklyEarnings: ((_b = weeklyEarnings[0]) === null || _b === void 0 ? void 0 : _b.total) || 0,
            yearlyEarnings: ((_c = yearlyEarnings[0]) === null || _c === void 0 ? void 0 : _c.total) || 0,
            bestSellingDishes: bestSellingDishes.map((dish) => ({
                name: `Dish ${dish._id}`,
                quantity: dish.quantity,
                revenue: dish.revenue,
            })),
        });
    }
    catch (error) {
        console.error("Error fetching order statistics:", error);
        res.status(500).json({
            message: "Failed to fetch statistics",
            error: error instanceof Error ? error.message : "Unknown error",
            stack: process.env.NODE_ENV === "development"
                ? error instanceof Error
                    ? error.stack
                    : undefined
                : undefined,
        });
    }
};
exports.getOrderStats = getOrderStats;
//# sourceMappingURL=orderController.js.map