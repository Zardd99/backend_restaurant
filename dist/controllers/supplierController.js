"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupplierOrders = exports.getSupplierLowStockAlerts = exports.getSupplierPerformance = exports.deleteSupplier = exports.updateSupplier = exports.createSupplier = exports.getSupplierById = exports.getAllSuppliers = void 0;
const Supplier_1 = require("../models/Supplier");
const mongoose_1 = __importDefault(require("mongoose"));
const getAllSuppliers = async (req, res) => {
    try {
        const { active } = req.query;
        const filter = {};
        if (active === "true" || active === "false") {
            filter.isActive = active === "true";
        }
        const suppliers = await Supplier_1.Supplier.find(filter).populate("suppliedIngredients", "name unit");
        res.json(suppliers);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching suppliers", error });
    }
};
exports.getAllSuppliers = getAllSuppliers;
const getSupplierById = async (req, res) => {
    try {
        const supplier = await Supplier_1.Supplier.findById(req.params.id).populate("suppliedIngredients", "name description unit costPerUnit");
        if (!supplier) {
            return res.status(404).json({ message: "Supplier not found" });
        }
        res.json(supplier);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching supplier", error });
    }
};
exports.getSupplierById = getSupplierById;
const createSupplier = async (req, res) => {
    try {
        const supplierData = req.body;
        const existingSupplier = await Supplier_1.Supplier.findOne({
            name: supplierData.name,
        });
        if (existingSupplier) {
            return res.status(409).json({ message: "Supplier already exists" });
        }
        const newSupplier = new Supplier_1.Supplier(supplierData);
        const savedSupplier = await newSupplier.save();
        res.status(201).json(savedSupplier);
    }
    catch (error) {
        res.status(400).json({ message: "Error creating supplier", error });
    }
};
exports.createSupplier = createSupplier;
const updateSupplier = async (req, res) => {
    try {
        const updatedSupplier = await Supplier_1.Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updatedSupplier) {
            return res.status(404).json({ message: "Supplier not found" });
        }
        res.json(updatedSupplier);
    }
    catch (error) {
        res.status(400).json({ message: "Error updating supplier", error });
    }
};
exports.updateSupplier = updateSupplier;
const deleteSupplier = async (req, res) => {
    try {
        const supplier = await Supplier_1.Supplier.findById(req.params.id);
        if (!supplier) {
            return res.status(404).json({ message: "Supplier not found" });
        }
        const activeIngredients = await Supplier_1.Ingredient.findOne({
            supplier: req.params.id,
            isActive: true,
        });
        if (activeIngredients) {
            return res.status(400).json({
                message: "Cannot delete supplier with active ingredients",
            });
        }
        supplier.isActive = false;
        await supplier.save();
        res.json({ message: "Supplier deactivated successfully" });
    }
    catch (error) {
        res.status(500).json({ message: "Error deleting supplier", error });
    }
};
exports.deleteSupplier = deleteSupplier;
const getSupplierPerformance = async (req, res) => {
    try {
        const { id } = req.params;
        const deliveryStats = await Supplier_1.PurchaseOrder.aggregate([
            {
                $match: {
                    supplier: new mongoose_1.default.Types.ObjectId(id),
                    status: "delivered",
                    actualDelivery: { $exists: true },
                },
            },
            {
                $project: {
                    deliveryDelay: {
                        $subtract: ["$actualDelivery", "$expectedDelivery"],
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    avgDeliveryDelay: { $avg: "$deliveryDelay" },
                    onTimeRate: {
                        $avg: {
                            $cond: [{ $lte: ["$deliveryDelay", 0] }, 1, 0],
                        },
                    },
                },
            },
        ]);
        const orderStats = await Supplier_1.PurchaseOrder.aggregate([
            {
                $match: {
                    supplier: new mongoose_1.default.Types.ObjectId(id),
                    status: "delivered",
                },
            },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalSpent: { $sum: "$totalAmount" },
                },
            },
        ]);
        res.json({
            deliveryPerformance: deliveryStats[0] || {
                avgDeliveryDelay: 0,
                onTimeRate: 0,
            },
            orderStatistics: orderStats[0] || { totalOrders: 0, totalSpent: 0 },
        });
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching performance data", error });
    }
};
exports.getSupplierPerformance = getSupplierPerformance;
const getSupplierLowStockAlerts = async (req, res) => {
    try {
        const lowStockItems = await Supplier_1.LowStockNotification.find({
            ingredient: { $in: await Supplier_1.Ingredient.find({ supplier: req.params.id }) },
            acknowledged: false,
        }).populate("ingredient", "name currentStock minStock");
        res.json(lowStockItems);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching low stock alerts", error });
    }
};
exports.getSupplierLowStockAlerts = getSupplierLowStockAlerts;
const getSupplierOrders = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = {
            supplier: req.params.id,
        };
        if (status) {
            filter.status = status;
        }
        const orders = await Supplier_1.PurchaseOrder.find(filter)
            .populate("items.ingredient", "name unit")
            .sort({ orderDate: -1 });
        res.json(orders);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching orders", error });
    }
};
exports.getSupplierOrders = getSupplierOrders;
//# sourceMappingURL=supplierController.js.map