import { Request, Response } from "express";
import { PromotionService } from "../services/PromotionService";
import Promotion from "../models/Promotion";
import { AuthRequest } from "../middleware/auth";
import MenuItem from "@/models/MenuItem";

const promotionService = new PromotionService();

/**
 * GET /api/promotions
 * Get all promotions (with optional filtering for active ones)
 */
export const getAllPromotions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { active } = req.query;
    let promotions;

    if (active === "true") {
      promotions = await promotionService.getActivePromotions();
    } else {
      // Get all promotions (including inactive) for admin panel
      promotions = await Promotion.find().populate("createdBy", "name email");
    }

    res.json(promotions);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

/**
 * GET /api/promotions/:id
 * Get promotion by ID
 */
export const getPromotionById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const promotion = await promotionService.getPromotionById(req.params.id);
    if (!promotion) {
      res.status(404).json({ message: "Promotion not found" });
      return;
    }
    res.json(promotion);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

/**
 * POST /api/promotions
 * Create a new promotion (admin only)
 */
export const createPromotion = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    // The authenticated user is the creator
    const promotionData = {
      ...req.body,
      createdBy: req.user?._id,
    };

    // Validate dates
    if (new Date(promotionData.startDate) >= new Date(promotionData.endDate)) {
      res.status(400).json({ message: "End date must be after start date" });
      return;
    }

    const promotion = await promotionService.createPromotion(promotionData);
    res.status(201).json(promotion);
  } catch (error: any) {
    if (error.code === 11000) {
      res
        .status(400)
        .json({ message: "Promotion with this name already exists" });
    } else {
      res
        .status(400)
        .json({ message: "Error creating promotion", error: error.message });
    }
  }
};

/**
 * PUT /api/promotions/:id
 * Update a promotion (admin only)
 */
export const updatePromotion = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    // Validate dates if provided
    if (req.body.startDate && req.body.endDate) {
      if (new Date(req.body.startDate) >= new Date(req.body.endDate)) {
        res.status(400).json({ message: "End date must be after start date" });
        return;
      }
    }

    const promotion = await promotionService.updatePromotion(
      req.params.id,
      req.body,
    );
    if (!promotion) {
      res.status(404).json({ message: "Promotion not found" });
      return;
    }
    res.json(promotion);
  } catch (error: any) {
    res
      .status(400)
      .json({ message: "Error updating promotion", error: error.message });
  }
};

/**
 * DELETE /api/promotions/:id
 * Deactivate a promotion (admin only)
 */
export const deletePromotion = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const promotion = await promotionService.deletePromotion(req.params.id);
    if (!promotion) {
      res.status(404).json({ message: "Promotion not found" });
      return;
    }
    res.json({ message: "Promotion deactivated successfully", promotion });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

/**
 * GET /api/promotions/validate/:menuItemId
 * Validate and get applicable promotions for a menu item
 */
export const validatePromotionForMenuItem = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const menuItem = await MenuItem.findById(req.params.menuItemId);
    if (!menuItem) {
      res.status(404).json({ message: "Menu item not found" });
      return;
    }

    const promotion =
      await promotionService.computeBestPromotionForMenuItem(menuItem);
    res.json({
      applicable: !!promotion,
      promotion: promotion
        ? {
            _id: promotion.promotion._id,
            name: promotion.promotion.name,
            discountType: promotion.promotion.discountType,
            discountValue: promotion.promotion.discountValue,
            discountAmount: promotion.discountAmount,
            finalPrice: promotion.finalPrice,
          }
        : null,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
