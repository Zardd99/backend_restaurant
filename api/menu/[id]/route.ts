import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import MenuItem from "../../../models/MenuItem";
import { connectDB } from "../../../utils/db";
import { Types } from "mongoose";

/**
 * API Route: /api/menu/[id]
 * Handles GET, PUT, PATCH, and DELETE operations for a specific menu item
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
      message: "Invalid Menu Item ID Format",
    });
  }

  try {
    switch (req.method) {
      case "GET":
        return handleGetMenuItem(req, res, id as string);
      case "PUT":
        return handleUpdateMenuItem(req, res, id as string, session);
      case "PATCH":
        return handlePartialUpdate(req, res, id as string, session);
      case "DELETE":
        return handleDeleteMenuItem(req, res, id as string, session);
      default:
        res.setHeader("Allow", ["GET", "PUT", "PATCH", "DELETE"]);
        return res
          .status(405)
          .json({ message: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error("Error in menu API:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
}

/**
 * GET /api/menu/[id]
 * Retrieve a specific menu item by ID
 */
async function handleGetMenuItem(
  req: NextApiRequest,
  res: NextApiResponse,
  id: string
) {
  try {
    const menuItem = await MenuItem.findById(id).populate(
      "category",
      "name description"
    );

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    return res.status(200).json(menuItem);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching menu item",
      error: error instanceof Error ? error.message : "Error",
    });
  }
}

/**
 * PUT /api/menu/[id]
 * Update a menu item (full update)
 */
async function handleUpdateMenuItem(
  req: NextApiRequest,
  res: NextApiResponse,
  id: string,
  session: any
) {
  try {
    // Check if user has permission to update menu items
    if (!["admin", "manager"].includes(session.user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "Permission denied. Only admins and managers can update menu items.",
      });
    }

    const menuItem = await MenuItem.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    }).populate("category", "name");

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    return res.status(200).json(menuItem);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Error updating menu item",
      error: error instanceof Error ? error.message : "Error",
    });
  }
}

/**
 * PATCH /api/menu/[id]
 * Partially update a menu item
 */
async function handlePartialUpdate(
  req: NextApiRequest,
  res: NextApiResponse,
  id: string,
  session: any
) {
  try {
    // Check if user has permission to update menu items
    if (!["admin", "manager"].includes(session.user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "Permission denied. Only admins and managers can update menu items.",
      });
    }

    const menuItem = await MenuItem.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    }).populate("category", "name");

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    return res.status(200).json(menuItem);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Error updating menu item",
      error: error instanceof Error ? error.message : "Error",
    });
  }
}

/**
 * DELETE /api/menu/[id]
 * Delete a menu item
 */
async function handleDeleteMenuItem(
  req: NextApiRequest,
  res: NextApiResponse,
  id: string,
  session: any
) {
  try {
    // Check if user has permission to delete menu items
    if (!["admin", "manager"].includes(session.user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "Permission denied. Only admins and managers can delete menu items.",
      });
    }

    const menuItem = await MenuItem.findByIdAndDelete(id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Menu item deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error deleting menu item",
      error: error instanceof Error ? error.message : "Error",
    });
  }
}
