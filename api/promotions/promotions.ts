import express, { Request, Response } from "express";
import { authenticate, authorize } from "../../middleware/auth";
import Promotion from "../../models/Promotion";

// Extend Express Request to include user property
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const router = express.Router();

/**
 * GET /api/promotions/active
 * Retrieve currently active promotions (public endpoint - no auth required)
 */
router.get("/active", async (req, res) => {
  try {
    const now = new Date();
    const activePromotions = await Promotion.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).select(
      "name description discountType discountValue appliesTo targetIds",
    );
    res.json(activePromotions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch active promotions" });
  }
});

// All routes below require authentication
router.use(authenticate);

/**
 * GET /api/promotions
 * Retrieve all promotions (admin only)
 */
router.get("/", authorize("admin"), async (req, res) => {
  try {
    const promotions = await Promotion.find({})
      .populate("createdBy", "name email")
      .sort({ startDate: -1 });
    res.json(promotions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch promotions" });
  }
});

/**
 * GET /api/promotions/:id
 * Retrieve a specific promotion (admin only)
 */
router.get("/:id", authorize("admin"), async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id).populate(
      "createdBy",
      "name email",
    );
    if (!promotion) {
      return res.status(404).json({ error: "Promotion not found" });
    }
    res.json(promotion);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch promotion" });
  }
});

/**
 * POST /api/promotions
 * Create a new promotion (admin only)
 */
router.post("/", authorize("admin"), async (req, res) => {
  try {
    const {
      name,
      description,
      discountType,
      discountValue,
      appliesTo,
      targetIds,
      startDate,
      endDate,
      minimumOrderAmount,
      maxUsagePerCustomer,
    } = req.body;

    // Validate required fields
    if (
      !name ||
      !discountType ||
      !discountValue ||
      !appliesTo ||
      !startDate ||
      !endDate
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate discount value
    if (
      discountType === "percentage" &&
      (discountValue < 0 || discountValue > 100)
    ) {
      return res
        .status(400)
        .json({ error: "Percentage discount must be between 0 and 100" });
    }

    // Validate dates
    if (new Date(startDate) > new Date(endDate)) {
      return res
        .status(400)
        .json({ error: "Start date must be before end date" });
    }

    const promotion = await Promotion.create({
      name,
      description,
      discountType,
      discountValue,
      appliesTo,
      targetIds: targetIds || [],
      startDate,
      endDate,
      minimumOrderAmount,
      maxUsagePerCustomer,
      createdBy: req.user._id,
    });

    res.status(201).json(promotion);
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "Promotion name already exists" });
    }
    res.status(500).json({ error: "Failed to create promotion" });
  }
});

/**
 * PUT /api/promotions/:id
 * Update a promotion (admin only)
 */
router.put("/:id", authorize("admin"), async (req, res) => {
  try {
    const {
      name,
      description,
      discountType,
      discountValue,
      appliesTo,
      targetIds,
      startDate,
      endDate,
      isActive,
      minimumOrderAmount,
      maxUsagePerCustomer,
    } = req.body;

    // Validate discount value if updating
    if (
      discountValue !== undefined &&
      discountType === "percentage" &&
      (discountValue < 0 || discountValue > 100)
    ) {
      return res
        .status(400)
        .json({ error: "Percentage discount must be between 0 and 100" });
    }

    const promotion = await Promotion.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        discountType,
        discountValue,
        appliesTo,
        targetIds,
        startDate,
        endDate,
        isActive,
        minimumOrderAmount,
        maxUsagePerCustomer,
      },
      { new: true, runValidators: true },
    );

    if (!promotion) {
      return res.status(404).json({ error: "Promotion not found" });
    }

    res.json(promotion);
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "Promotion name already exists" });
    }
    res.status(500).json({ error: "Failed to update promotion" });
  }
});

/**
 * DELETE /api/promotions/:id
 * Delete/deactivate a promotion (admin only)
 */
router.delete("/:id", authorize("admin"), async (req, res) => {
  try {
    const promotion = await Promotion.findByIdAndDelete(req.params.id);

    if (!promotion) {
      return res.status(404).json({ error: "Promotion not found" });
    }

    res.json({ message: "Promotion deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete promotion" });
  }
});

export default router;
