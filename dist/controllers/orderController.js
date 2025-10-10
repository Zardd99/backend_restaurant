"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderStatus = exports.deleteOrder = exports.updateOrder = exports.createOrder = exports.getOrderById = exports.getAllOrders = void 0;
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
//# sourceMappingURL=orderController.js.map