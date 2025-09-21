import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import User from "../../../models/User";
import { connectDB } from "../../../utils/db";
import { Types } from "mongoose";

/**
 * API Route: /api/users/[id]
 * Handles GET, PUT, PATCH, and DELETE operations for a specific user
 * All operations require admin privileges
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

  // Check if user has admin privileges
  if (session.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Permission denied. Only admins can access user management.",
    });
  }

  // Validate ID format
  if (!Types.ObjectId.isValid(id as string)) {
    return res.status(400).json({
      success: false,
      message: "Invalid User ID Format",
    });
  }

  try {
    switch (req.method) {
      case "GET":
        return handleGetUser(req, res, id as string);
      case "PUT":
        return handleUpdateUser(req, res, id as string);
      case "PATCH":
        return handlePartialUpdate(req, res, id as string);
      case "DELETE":
        return handleDeleteUser(req, res, id as string);
      default:
        res.setHeader("Allow", ["GET", "PUT", "PATCH", "DELETE"]);
        return res
          .status(405)
          .json({ message: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error("Error in users API:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
}

/**
 * GET /api/users/[id]
 * Retrieve a specific user by ID (admin only)
 */
async function handleGetUser(
  req: NextApiRequest,
  res: NextApiResponse,
  id: string
) {
  try {
    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error instanceof Error ? error.message : "Error",
    });
  }
}

/**
 * PUT /api/users/[id]
 * Update a user (full update, admin only)
 */
async function handleUpdateUser(
  req: NextApiRequest,
  res: NextApiResponse,
  id: string
) {
  try {
    const { name, email, role, phone, isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { name, email, role, phone, isActive },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Error updating user",
      error: error instanceof Error ? error.message : "Error",
    });
  }
}

/**
 * PATCH /api/users/[id]
 * Partially update a user (admin only)
 */
async function handlePartialUpdate(
  req: NextApiRequest,
  res: NextApiResponse,
  id: string
) {
  try {
    // Only allow certain fields to be updated
    const allowedUpdates = ["name", "email", "role", "phone", "isActive"];
    const updates = Object.keys(req.body);
    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid updates. Only name, email, role, phone, and isActive fields can be updated.",
      });
    }

    const user = await User.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Error updating user",
      error: error instanceof Error ? error.message : "Error",
    });
  }
}

/**
 * DELETE /api/users/[id]
 * Delete a user (admin only)
 */
async function handleDeleteUser(
  req: NextApiRequest,
  res: NextApiResponse,
  id: string
) {
  try {
    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error instanceof Error ? error.message : "Error",
    });
  }
}
