import { Request, Response } from "express";
import {
  Supplier,
  ISupplier,
  Ingredient,
  PurchaseOrder,
  LowStockNotification,
} from "../models/Supplier";
import mongoose from "mongoose";

/**
 * GET /api/supplier
 * Retrieve all suppliers with optional filtering by active status
 *
 *
 * @param req Express - Request object with query parameters
 * @param res Express - Response object
 *
 * Query Parameters:
 * - active: Filter by active status (true/false)
 *
 * @return JSON response with array of suppliers or error message
 */
interface SupplierFilter {
  isActive?: boolean;
}

export const getAllSuppliers = async (req: Request, res: Response) => {
  try {
    const { active } = req.query;
    const filter: SupplierFilter = {};

    if (active === "true" || active === "false") {
      filter.isActive = active === "true";
    }

    const suppliers = await Supplier.find(filter).populate(
      "suppliedIngredients",
      "name unit"
    );
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: "Error fetching suppliers", error });
  }
};

/**
 * GET api/supplier/:id
 * Retrieve all suppliers by ID with populated supplied ingredients
 *
 * @param req Express - Request object with ID parameter
 * @param res Express - Response object
 *
 * URL Parameters:
 * - id: Supplier ID (MongoDB ObjectId)
 *
 * @returns JSON response with array of suppliers or error message
 */
export const getSupplierById = async (req: Request, res: Response) => {
  try {
    const supplier = await Supplier.findById(req.params.id).populate(
      "suppliedIngredients",
      "name description unit costPerUnit"
    );

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    res.json(supplier);
  } catch (error) {
    res.status(500).json({ message: "Error fetching supplier", error });
  }
};

/**
 * POST /api/supplier
 * Create a new supplier
 *
 * @param req - Express Request object with supplier data in body
 * @param res - Express Response object
 *
 * Body Parameters:
 * - name: Supplier name (string, required)
 * - description: Supplier description (string, required)
 *
 * @returns JSON response with created supplier or error message
 */
export const createSupplier = async (req: Request, res: Response) => {
  try {
    const supplierData: ISupplier = req.body;

    // Check if supplier already exists
    const existingSupplier = await Supplier.findOne({
      name: supplierData.name,
    });
    if (existingSupplier) {
      return res.status(409).json({ message: "Supplier already exists" });
    }

    const newSupplier = new Supplier(supplierData);
    const savedSupplier = await newSupplier.save();
    res.status(201).json(savedSupplier);
  } catch (error) {
    res.status(400).json({ message: "Error creating supplier", error });
  }
};

/**
 * PUT /api/supplier/:id
 * Update supplier details by ID
 *
 * @param req - Express Request object with ID
 * @param res - Express Response object
 *
 * URL Parameters:
 * - id: Supplier id (MongoDB ObjectID)
 *
 * Request Body: Complete supplier data following ISupplier interface
 * @returns JSON response with updated supplier or error message
 */
export const updateSupplier = async (req: Request, res: Response) => {
  try {
    const updatedSupplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedSupplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    res.json(updatedSupplier);
  } catch (error) {
    res.status(400).json({ message: "Error updating supplier", error });
  }
};

// Delete supplier (soft delete via isActive toggle)
export const deleteSupplier = async (req: Request, res: Response) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    // Check if supplier is used in any active ingredients
    const activeIngredients = await Ingredient.findOne({
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
  } catch (error) {
    res.status(500).json({ message: "Error deleting supplier", error });
  }
};

// Get supplier performance metrics
export const getSupplierPerformance = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get average delivery time
    const deliveryStats = await PurchaseOrder.aggregate([
      {
        $match: {
          supplier: new mongoose.Types.ObjectId(id),
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

    // Get total orders and spending
    const orderStats = await PurchaseOrder.aggregate([
      {
        $match: {
          supplier: new mongoose.Types.ObjectId(id),
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
  } catch (error) {
    res.status(500).json({ message: "Error fetching performance data", error });
  }
};

/**
 * GET /api/supplier/:id/low-stock
 *
 *
 * @param req - Express Request object with supplier ID parameter
 * @param res - Express Response object
 *
 * URL Parameters:
 * - id: Supplier ID (MongoDB ObjectId)
 *
 * @returns JSON response with low stock alerts or error message
 */
export const getSupplierLowStockAlerts = async (
  req: Request,
  res: Response
) => {
  try {
    const lowStockItems = await LowStockNotification.find({
      ingredient: { $in: await Ingredient.find({ supplier: req.params.id }) },
      acknowledged: false,
    }).populate("ingredient", "name currentStock minStock");

    res.json(lowStockItems);
  } catch (error) {
    res.status(500).json({ message: "Error fetching low stock alerts", error });
  }
};

/**
 * GET /api/supplier/:id/orders
 *
 * @param req - Express Request object with supplier ID parameter
 * @param res - Express Response object
 *
 * @returns JSON response with supplier orders or error message
 */
export const getSupplierOrders = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const filter: { supplier: string; status?: string } = {
      supplier: req.params.id,
    };

    if (status) {
      filter.status = status as string;
    }

    const orders = await PurchaseOrder.find(filter)
      .populate("items.ingredient", "name unit")
      .sort({ orderDate: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders", error });
  }
};
