"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processPayment = exports.getServedOrders = void 0;
const Order_1 = __importDefault(require("../models/Order"));
const Receipt_1 = __importDefault(require("../models/Receipt"));
const PAYMENT_METHODS = ["cash", "credit_card", "debit_card", "KHQR"];
const getServedOrders = async (req, res) => {
    try {
        const { paymentStatus } = req.query;
        const filter = { status: "served" };
        if (paymentStatus === "unpaid" || paymentStatus === "paid") {
            filter.paymentStatus = paymentStatus;
        }
        const orders = await Order_1.default.find(filter)
            .populate("items.menuItem", "name category")
            .sort({ updatedAt: -1 })
            .lean();
        res.json({ success: true, orders });
    }
    catch (_a) {
        res.status(500).json({ success: false, message: "Failed to fetch served orders" });
    }
};
exports.getServedOrders = getServedOrders;
const processPayment = async (req, res) => {
    var _a;
    try {
        const id = req.params.id;
        const { paymentMethod } = req.body;
        if (!paymentMethod || !PAYMENT_METHODS.includes(paymentMethod)) {
            res.status(400).json({
                success: false,
                message: `Payment method must be one of: ${PAYMENT_METHODS.join(", ")}`,
            });
            return;
        }
        const order = await Order_1.default.findById(id);
        if (!order) {
            res.status(404).json({ success: false, message: "Order not found" });
            return;
        }
        if (order.status !== "served") {
            res.status(400).json({
                success: false,
                message: "Only served orders can be processed for payment",
            });
            return;
        }
        if (order.paymentStatus === "paid") {
            res.status(400).json({ success: false, message: "Order is already paid" });
            return;
        }
        order.paymentStatus = "paid";
        order.paymentMethod = paymentMethod;
        order.paidAt = new Date();
        await order.save();
        const existingReceipt = await Receipt_1.default.findOne({ order: id });
        if (!existingReceipt) {
            const populatedOrder = await Order_1.default.findById(id).populate("items.menuItem", "name");
            if (populatedOrder) {
                const discount = (_a = populatedOrder.totalDiscountAmount) !== null && _a !== void 0 ? _a : 0;
                const subtotal = populatedOrder.totalAmount + discount;
                const receiptItems = populatedOrder.items.map((item) => {
                    var _a, _b, _c, _d, _e;
                    return ({
                        menuItem: (_b = (_a = item.menuItem) === null || _a === void 0 ? void 0 : _a._id) !== null && _b !== void 0 ? _b : item.menuItem,
                        name: (_d = (_c = item.menuItem) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : "Item",
                        quantity: item.quantity,
                        price: (_e = item.finalPrice) !== null && _e !== void 0 ? _e : item.price,
                    });
                });
                const ts = Date.now().toString();
                const rand = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
                await Receipt_1.default.create({
                    order: id,
                    receiptNumber: `RCP-${ts}-${rand}`,
                    paymentMethod,
                    paymentStatus: "completed",
                    subtotal,
                    tax: 0,
                    discount,
                    totalAmount: populatedOrder.totalAmount,
                    items: receiptItems,
                });
            }
        }
        req.app.get("io").emit("billing:payment_updated", {
            orderId: id,
            paymentStatus: "paid",
            paymentMethod,
            tableNumber: order.tableNumber,
            totalAmount: order.totalAmount,
        });
        res.json({ success: true, order });
    }
    catch (_b) {
        res.status(500).json({ success: false, message: "Failed to process payment" });
    }
};
exports.processPayment = processPayment;
//# sourceMappingURL=billingController.js.map