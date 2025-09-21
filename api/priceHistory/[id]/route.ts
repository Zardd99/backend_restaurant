import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import PriceHistory from "../../../models/PriceHistory";
import { connectDB } from "../../../utils/db";
import { Types } from "mongoose";

/**
 * API Route: /api/priceHistory/[id]
 * Handles GET, PUT, PATCH, and DELETE operations for a specific price history record
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  // Connect to database
  await connectDB();

  // Get user session for authentication
  const session = await getSession({ req });

  // Check authentication
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Validate ID format
  if (!Types.ObjectId.isValid(id as string)) {
    return res.status(400).json({
      success: false,
      message: "Invalid Price History ID Format",
    });
  }

  try {
    switch (req.method) {
      case "GET":
        return handleGetPriceHistory(req, res, id as string);
      case "PUT":
        return handleUpdatePriceHistory(req, res, id as string, session);
      case "PATCH":
        return handlePartialUpdate(req, res, id as string, session); // Added session parameter
      case "DELETE":
        return handleDeletePriceHistory(req, res, id as string, session); // Added session parameter
      default:
        res.setHeader("Allow", ["GET", "PUT", "PATCH", "DELETE"]);
        return res
          .status(405)
          .json({ message: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error("Error in priceHistory API:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
}

/**
 * GET /api/priceHistory/[id]
 * Retrieve a specific price history record by ID
 */
async function handleGetPriceHistory(
  req: NextApiRequest,
  res: NextApiResponse,
  id: string
) {
  try {
    const priceHistory = await PriceHistory.findById(id)
      .populate("menuItem", "name price category description")
      .populate("changedBy", "name email");

    if (!priceHistory) {
      return res.status(404).json({
        success: false,
        message: "Price History not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: priceHistory,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching price history",
      error: error instanceof Error ? error.message : "Error",
    });
  }
}

/**
 * PUT /api/priceHistory/[id]
 * Update a price history record (full update)
 * Note: Price history records are typically immutable, so this might be restricted
 */
async function handleUpdatePriceHistory(
  req: NextApiRequest,
  res: NextApiResponse,
  id: string,
  session: any
) {
  try {
    // Check if user has permission to update price history
    // Typically, price history should be immutable, so we might restrict this to admins
    if (session.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Permission denied. Only admins can update price history records.",
      });
    }

    const priceHistory = await PriceHistory.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("menuItem", "name price category")
      .populate("changedBy", "name email");

    if (!priceHistory) {
      return res.status(404).json({
        success: false,
        message: "Price History not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: priceHistory,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error updating price history",
      error: error instanceof Error ? error.message : "Error",
    });
  }
}

/**
 * PATCH /api/priceHistory/[id]
 * Partially update a price history record
 * Note: Price history records are typically immutable, so this might be restricted
 */
async function handlePartialUpdate(
  req: NextApiRequest,
  res: NextApiResponse,
  id: string,
  session: any
) {
  try {
    // Check if user has permission to update price history
    if (session.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Permission denied. Only admins can update price history records.",
      });
    }

    // Only allow certain fields to be updated
    const allowedUpdates = ["reason", "notes"];
    const updates = Object.keys(req.body);
    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid updates. Only "reason" and "notes" fields can be updated.',
      });
    }

    const priceHistory = await PriceHistory.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("menuItem", "name price category")
      .populate("changedBy", "name email");

    if (!priceHistory) {
      return res.status(404).json({
        success: false,
        message: "Price History not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: priceHistory,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error updating price history",
      error: error instanceof Error ? error.message : "Error",
    });
  }
}

/**
 * DELETE /api/priceHistory/[id]
 * Delete a price history record
 * Note: Price history records are typically immutable, so this might be restricted
 */
async function handleDeletePriceHistory(
  req: NextApiRequest,
  res: NextApiResponse,
  id: string,
  session: any
) {
  try {
    // Check if user has permission to delete price history
    if (session.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message:
          "Permission denied. Only admins can delete price history records.",
      });
    }

    const priceHistory = await PriceHistory.findByIdAndDelete(id);

    if (!priceHistory) {
      return res.status(404).json({
        success: false,
        message: "Price History not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Price History deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error deleting price history",
      error: error instanceof Error ? error.message : "Error",
    });
  }
}
