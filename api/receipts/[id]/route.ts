import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import Receipt from "../../../models/Receipt";
import Order from "../../../models/Order";
import { connectDB } from "../../../utils/db";
import { validateReceiptUpdate } from "../../../utils/validation";

/**
 * API Route: /api/receipts/[id]
 * Handles GET, PUT, PATCH, and DELETE operations for a specific receipt
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

  try {
    switch (req.method) {
      case "GET":
        return handleGetReceipt(req, res, id as string);
      case "PUT":
        return handleUpdateReceipt(req, res, id as string);
      case "PATCH":
        return handlePartialUpdate(req, res, id as string);
      case "DELETE":
        return handleDeleteReceipt(req, res, id as string);
      default:
        res.setHeader("Allow", ["GET", "PUT", "PATCH", "DELETE"]);
        return res
          .status(405)
          .json({ message: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error("Error in receipts API:", error);
    return res.status(500).json({
      message: "Server error",
      error: error instanceof Error ? error.message : "Error",
    });
  }
}

/**
 * GET /api/receipts/[id]
 * Retrieve a specific receipt by ID
 */
async function handleGetReceipt(
  req: NextApiRequest,
  res: NextApiResponse,
  id: string
) {
  try {
    const receipt = await Receipt.findById(id)
      .populate("customer", "name email phone")
      .populate("order")
      .populate("items.menuItem", "name description");

    if (!receipt) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    return res.status(200).json(receipt);
  } catch (error) {
    console.error("Error in receipts API:", error);
    return res.status(500).json({
      message: "Server error",
      error: error instanceof Error ? error.message : "Error",
    });
  }
}

/**
 * PUT /api/receipts/[id]
 * Update a receipt (full update)
 */
async function handleUpdateReceipt(
  req: NextApiRequest,
  res: NextApiResponse,
  id: string
) {
  try {
    // Validate request body
    const validationErrors = validateReceiptUpdate(req.body);
    if (validationErrors.length > 0) {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: validationErrors });
    }

    const receipt = await Receipt.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("customer", "name email")
      .populate("order");

    if (!receipt) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    return res.status(200).json(receipt);
  } catch (error) {
    console.error("Error in receipts API:", error);
    return res.status(500).json({
      message: "Server error",
      error: error instanceof Error ? error.message : "Error",
    });
  }
}

/**
 * PATCH /api/receipts/[id]
 * Partially update a receipt
 */
async function handlePartialUpdate(
  req: NextApiRequest,
  res: NextApiResponse,
  id: string
) {
  try {
    // Only allow certain fields to be updated
    const allowedUpdates = ["paymentStatus", "discount"];
    const updates = Object.keys(req.body);
    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      return res.status(400).json({ message: "Invalid updates" });
    }

    // Recalculate total if discount changed
    if (req.body.discount !== undefined) {
      const receipt = await Receipt.findById(id);
      if (receipt) {
        req.body.totalAmount =
          receipt.subtotal + receipt.tax - req.body.discount;
      }
    }

    const receipt = await Receipt.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("customer", "name email")
      .populate("order");

    if (!receipt) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    return res.status(200).json(receipt);
  } catch (error) {
    console.error("Error in receipts API:", error);
    return res.status(500).json({
      message: "Server error",
      error: error instanceof Error ? error.message : "Error",
    });
  }
}

/**
 * DELETE /api/receipts/[id]
 * Delete a receipt
 */
async function handleDeleteReceipt(
  req: NextApiRequest,
  res: NextApiResponse,
  id: string
) {
  try {
    const receipt = await Receipt.findByIdAndDelete(id);

    if (!receipt) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    return res.status(200).json({ message: "Receipt deleted successfully" });
  } catch (error) {
    console.error("Error in receipts API:", error);
    return res.status(500).json({
      message: "Server error",
      error: error instanceof Error ? error.message : "Error",
    });
  }
}
