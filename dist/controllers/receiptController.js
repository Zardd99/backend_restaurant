"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateReceipt = exports.getReceiptByOrderId = exports.getReceiptById = exports.getAllReceipts = exports.createReceipt = void 0;
const Order_1 = __importDefault(require("../models/Order"));
const Receipt_1 = __importDefault(require("../models/Receipt"));
const generateReceiptNumber = () => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
    return `RCP-${timestamp}-${random}`;
};
const createReceipt = async (req, res) => {
    try {
        const { orderId, paymentMethod, discount = 0 } = req.body;
        const order = await Order_1.default.findById(orderId)
            .populate("customer", "name email")
            .populate("items.menuItem", "name price");
        if (!order) {
            res.status(404).json({ message: "Order not found" });
            return;
        }
        const existingReceipt = await Receipt_1.default.findOne({ order: orderId });
        if (existingReceipt) {
            res
                .status(400)
                .json({ message: "Receipt already exists for this order" });
            return;
        }
        const taxRate = 0.1;
        const subtotal = order.totalAmount;
        const tax = subtotal * taxRate;
        const totalAmount = subtotal + tax - discount;
        const receiptItems = order.items.map((item) => ({
            name: item.menuItem.name,
            quantity: item.quantity,
            price: item.price,
        }));
        const receipt = new Receipt_1.default({
            order: orderId,
            receiptNumber: generateReceiptNumber(),
            paymentMethod,
            subtotal,
            tax,
            discount,
            totalAmount,
            customer: order.customer._id,
            items: receiptItems,
        });
        const savedReceipt = await receipt.save();
        await savedReceipt.populate("customer", "name email");
        await savedReceipt.populate("order");
        res.status(201).json(savedReceipt);
    }
    catch (error) {
        res.status(400).json({ message: "Error creating receipt", error });
    }
};
exports.createReceipt = createReceipt;
const getAllReceipts = async (req, res) => {
    try {
        const { paymentMethod, paymentStatus, startDate, endDate, minAmount, maxAmount, } = req.query;
        const filter = {};
        if (paymentMethod)
            filter.paymentMethod = paymentMethod;
        if (paymentStatus)
            filter.paymentStatus = paymentStatus;
        if (startDate || endDate) {
            filter.issuedAt = {};
            if (startDate)
                filter.issuedAt.$gte = new Date(startDate);
            if (endDate)
                filter.issuedAt.$lte = new Date(endDate);
        }
        if (minAmount || maxAmount) {
            filter.totalAmount = {};
            if (minAmount)
                filter.totalAmount.$gte = Number(minAmount);
            if (maxAmount)
                filter.totalAmount.$lte = Number(maxAmount);
        }
        const receipts = await Receipt_1.default.find(filter)
            .populate("customer", "name email")
            .populate("order")
            .sort({ issuedAt: -1 });
        res.json(receipts);
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};
exports.getAllReceipts = getAllReceipts;
const getReceiptById = async (req, res) => {
    try {
        const receipt = await Receipt_1.default.findById(req.params.id)
            .populate("customer", "name email phone")
            .populate("order")
            .populate("items.menuItem", "name description");
        if (!receipt) {
            res.status(404).json({ message: "Receipt not found" });
            return;
        }
        res.json(receipt);
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};
exports.getReceiptById = getReceiptById;
const getReceiptByOrderId = async (req, res) => {
    try {
        const receipt = await Receipt_1.default.findOne({ order: req.params.orderId })
            .populate("customer", "name email phone")
            .populate("order")
            .populate("items.menuItem", "name description");
        if (!receipt) {
            res.status(404).json({ message: "Receipt not found for this order" });
            return;
        }
        res.json(receipt);
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};
exports.getReceiptByOrderId = getReceiptByOrderId;
const updateReceipt = async (req, res) => {
    try {
        const { paymentStatus, discount } = req.body;
        const updateData = {};
        if (paymentStatus)
            updateData.paymentStatus = paymentStatus;
        if (discount !== undefined)
            updateData.discount = discount;
        if (discount !== undefined) {
            const receipt = await Receipt_1.default.findById(req.params.id);
            if (receipt) {
                updateData.totalAmount = receipt.subtotal + receipt.tax - discount;
            }
        }
        const updatedReceipt = await Receipt_1.default.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
            .populate("customer", "name email")
            .populate("order");
        if (!updatedReceipt) {
            res.status(404).json({ message: "Receipt not found" });
            return;
        }
        res.json(updatedReceipt);
    }
    catch (error) {
        res.status(400).json({ message: "Error updating receipt", error });
    }
};
exports.updateReceipt = updateReceipt;
//# sourceMappingURL=receiptController.js.map