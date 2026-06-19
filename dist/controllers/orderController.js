"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderStats = exports.updateOrderStatus = exports.deleteOrder = exports.updateOrder = exports.createOrder = exports.getOrderById = exports.getAllOrders = void 0;
const Order_1 = __importDefault(require("../models/Order"));
const MenuItem_1 = __importDefault(require("../models/MenuItem"));
const Notification_1 = __importDefault(require("../models/Notification"));
const StatsManager_1 = require("../domain/managers/StatsManager");
const PromotionService_1 = require("../services/PromotionService");
const TableOccupancyService_1 = require("../services/TableOccupancyService");
async function emitOrderNotification(io, payload) {
    io.emit("order:notification", payload);
    Notification_1.default.create({
        type: payload.type,
        orderId: payload.orderId,
        tableNumber: payload.tableNumber,
        customerName: payload.customerName,
        itemCount: payload.itemCount,
        actor: payload.actor,
        timestamp: new Date(payload.timestamp),
    }).catch((err) => console.error("Failed to persist notification:", err));
}
const getAllOrders = async (req, res) => {
    try {
        const { status, customer, orderType, startDate, endDate, minAmount, maxAmount, } = req.query;
        const filter = {};
        if (status)
            filter.status = status;
        if (customer)
            filter.customerName = customer;
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
    var _a, _b, _c, _d, _e, _f;
    try {
        console.log("Creating order with data:", req.body);
        const promotionService = new PromotionService_1.PromotionService();
        const orderData = Object.assign({}, req.body);
        let totalDiscountAmount = 0;
        let totalAmount = 0;
        if (req.body.customer) {
            orderData.customerName = req.body.customer;
        }
        delete orderData.customer;
        if (orderData.items &&
            Array.isArray(orderData.items) &&
            orderData.items.length > 0) {
            const enrichedItems = await Promise.all(orderData.items.map(async (item) => {
                var _a, _b, _c, _d;
                const menuItem = await MenuItem_1.default.findById(item.menuItem).populate("category");
                if (!menuItem) {
                    throw new Error(`Menu item not found: ${item.menuItem}`);
                }
                const appliedPromo = await promotionService.computeBestPromotionForMenuItem(menuItem);
                const finalPrice = (_a = appliedPromo === null || appliedPromo === void 0 ? void 0 : appliedPromo.finalPrice) !== null && _a !== void 0 ? _a : menuItem.price;
                const discountAmount = (_b = appliedPromo === null || appliedPromo === void 0 ? void 0 : appliedPromo.discountAmount) !== null && _b !== void 0 ? _b : 0;
                const itemTotalDiscount = discountAmount * item.quantity;
                totalDiscountAmount += itemTotalDiscount;
                totalAmount += finalPrice * item.quantity;
                return Object.assign(Object.assign({}, item), { originalPrice: menuItem.price, finalPrice: finalPrice, discountAmount: discountAmount, appliedPromotion: (_c = appliedPromo === null || appliedPromo === void 0 ? void 0 : appliedPromo.promotion._id) !== null && _c !== void 0 ? _c : null, price: (_d = item.price) !== null && _d !== void 0 ? _d : menuItem.price });
            }));
            orderData.items = enrichedItems;
            orderData.totalDiscountAmount = totalDiscountAmount;
            orderData.totalAmount = totalAmount;
        }
        if (!orderData.items ||
            !Array.isArray(orderData.items) ||
            orderData.items.length === 0) {
            res.status(400).json({ message: "Order must contain at least one item" });
            return;
        }
        if (orderData.orderType === "dine-in" && orderData.tableNumber != null) {
            const occupied = await TableOccupancyService_1.tableOccupancyService.isTableOccupied(Number(orderData.tableNumber));
            if (occupied) {
                res.status(409).json({
                    message: `Table ${orderData.tableNumber} is currently occupied by another order`,
                });
                return;
            }
        }
        const order = new Order_1.default(orderData);
        const savedOrder = await order.save();
        await savedOrder.populate([
            { path: "items.menuItem", select: "name price" },
            {
                path: "items.appliedPromotion",
                select: "name discountType discountValue",
            },
        ]);
        const io = req.app.get("io");
        if (io) {
            const actor = req.user;
            emitOrderNotification(io, {
                id: `${savedOrder._id}-created-${Date.now()}`,
                type: "order_created",
                orderId: savedOrder._id.toString(),
                tableNumber: savedOrder.tableNumber,
                customerName: savedOrder.customerName,
                itemCount: (_b = (_a = savedOrder.items) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0,
                actor: {
                    id: (_d = (_c = actor === null || actor === void 0 ? void 0 : actor._id) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : "",
                    name: (_e = actor === null || actor === void 0 ? void 0 : actor.name) !== null && _e !== void 0 ? _e : "Unknown",
                    role: (_f = actor === null || actor === void 0 ? void 0 : actor.role) !== null && _f !== void 0 ? _f : "unknown",
                },
                timestamp: new Date().toISOString(),
            });
            io.to("chef").emit("order_created", savedOrder);
        }
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
    var _a, _b, _c, _d, _e, _f;
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
            .populate("items.menuItem", "name price");
        if (!order) {
            res.status(404).json({ message: "Order not found" });
            return;
        }
        const notifTypeMap = {
            preparing: "order_preparing",
            ready: "order_ready",
            served: "order_served",
        };
        const notifType = notifTypeMap[status];
        const io = req.app.get("io");
        if (io) {
            if (notifType) {
                const actor = req.user;
                emitOrderNotification(io, {
                    id: `${order._id}-${status}-${Date.now()}`,
                    type: notifType,
                    orderId: order._id.toString(),
                    tableNumber: order.tableNumber,
                    customerName: order.customerName,
                    itemCount: (_b = (_a = order.items) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0,
                    actor: {
                        id: (_d = (_c = actor === null || actor === void 0 ? void 0 : actor._id) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : "",
                        name: (_e = actor === null || actor === void 0 ? void 0 : actor.name) !== null && _e !== void 0 ? _e : "Unknown",
                        role: (_f = actor === null || actor === void 0 ? void 0 : actor.role) !== null && _f !== void 0 ? _f : "unknown",
                    },
                    timestamp: new Date().toISOString(),
                });
            }
            io.to("waiter").emit("order_updated", { orderId: order._id, status });
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
    try {
        const statsManager = new StatsManager_1.StatsManager(Order_1.default);
        const result = await statsManager.getOrderStats();
        if (!result.ok) {
            console.error("StatsManager error:", result.error);
            res.json({
                dailyEarnings: 0,
                weeklyEarnings: 0,
                yearlyEarnings: 0,
                todayOrderCount: 0,
                avgOrderValue: 0,
                ordersByStatus: {},
                bestSellingDishes: [],
                message: "Statistics loaded with default values",
            });
            return;
        }
        res.json(result.value);
    }
    catch (error) {
        console.error("Error in getOrderStats controller:", {
            message: error.message,
            stack: error.stack,
        });
        res.json({
            dailyEarnings: 0,
            weeklyEarnings: 0,
            yearlyEarnings: 0,
            todayOrderCount: 0,
            avgOrderValue: 0,
            ordersByStatus: {},
            bestSellingDishes: [],
            message: "Statistics loaded with default values due to error",
        });
    }
};
exports.getOrderStats = getOrderStats;
//# sourceMappingURL=orderController.js.map