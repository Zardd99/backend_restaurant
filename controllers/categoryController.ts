import { Request, Response } from "express";
import Category from "../models/Category";

interface FilterConditions {
  name?: string;
  isActive?: boolean;
}

/**
 * GET /api/category
 * Fetch all categories with optional query-based filtering
 *
 * @param req - Express request containing optional query parameters
 * @param res - Express response object
 *
 * Supported Query Parameters:
 * - name: Performs a case-insensitive partial match on category name
 * - isActive: Filters categories by active status ("true" | "false")
 *
 * @returns
 * - success: Indicates request outcome
 * - count: Number of categories returned
 * - data: Array of category documents
 */
export const getAllCategory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { name, isActive } = req.query;
    const filter: FilterConditions = {};

    // Apply case-insensitive name search if provided
    if (name) {
      filter.name = { $regex: name as string, $options: "i" } as any;
    }

    // Apply active status filter if explicitly provided
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    // Retrieve categories based on constructed filter
    const categories = await Category.find(filter);

    res.json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    // Log error for debugging and monitoring purposes
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
