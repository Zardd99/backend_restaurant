import { Request, Response } from "express";
import Category from "../models/Category";

interface FilterConditions {
  name?: string;
  isActive?: boolean;
}

/**
 * GET api/category
 * Retrieve all Categories with optional filtering by name and active status
 *
 * @param req - Express Request object with query parameters
 * @param res - Express Response object
 *
 * Query Parameters:
 * - name: filter by category name (partial match)
 * - isActive: filter by category status (true/false)
 *
 * @returns JSON response with array of categories or error message
 */
export const getAllCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, isActive } = req.query;
    const filter: FilterConditions = {};

    if (name) {
      filter.name = { $regex: name as string, $options: "i" } as any;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const categories = await Category.find(filter);

    res.json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
