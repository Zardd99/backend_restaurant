import { Request, Response } from "express";
import PriceHistory from "../models/PriceHistory";
import { Types } from "mongoose";

interface FilterConditions {
  menuItem?: Types.ObjectId;
  oldPrice?: number;
  newPrice?: number;
  changedBy?: Types.ObjectId;
  changeDate?: {
    $gte?: Date;
    $lte?: Date;
  };
}

/**
 * GET api/priceHistory
 * Retrieve all price history with optional filtering
 */
export const getAllPriceHistories = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      menuItem,
      oldPrice,
      newPrice,
      changedBy,
      dateFrom,
      dateTo,
      specificDate,
    } = req.query;

    const filter: FilterConditions = {};

    // MenuItem filter
    if (menuItem && Types.ObjectId.isValid(menuItem as string)) {
      filter.menuItem = new Types.ObjectId(menuItem as string);
    }

    // ChangedBy filter
    if (changedBy && Types.ObjectId.isValid(changedBy as string)) {
      filter.changedBy = new Types.ObjectId(changedBy as string);
    }

    // Price filters
    if (oldPrice) filter.oldPrice = Number(oldPrice);
    if (newPrice) filter.newPrice = Number(newPrice);

    // Date filters
    if (dateFrom || dateTo) {
      filter.changeDate = {};
      if (dateFrom) {
        filter.changeDate.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        filter.changeDate.$lte = new Date(dateTo as string);
      }
    } else if (specificDate) {
      // Filter for a specific date (whole day)
      const queryDate = new Date(specificDate as string);
      const startOfDay = new Date(queryDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(queryDate);
      endOfDay.setHours(23, 59, 59, 999);

      filter.changeDate = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    const priceHistory = await PriceHistory.find(filter)
      .populate("menuItem", "name price category")
      .populate("changedBy", "name email"); // Also populate changedBy

    res.json({
      success: true,
      data: priceHistory,
      count: priceHistory.length,
    });
  } catch (error) {
    console.error("Server Error", error);
    res.status(500).json({
      success: false,
      message: "server error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};

/**
 * GET /api/priceHistory/:id
 * Retrieve a single priceHistory by ID
 */
export const getPriceHistoryById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({
        success: false,
        message: "Invalid Price History ID Format",
      });
      return;
    }

    const priceHistory = await PriceHistory.findById(req.params.id)
      .populate("menuItem", "name price category description")
      .populate("changedBy", "name email"); // Also populate changedBy

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
  } catch (error) {
    console.error("Error in getPriceHistoryById:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};
