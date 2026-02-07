import { Request, Response } from "express";
import MenuItem, { IMenuItem } from "../models/MenuItem";
import Category from "../models/Category";

interface FilterConditions {
  category?: string;
  dietaryTags?: string;
  availability?: boolean;
  chefSpecial?: boolean;
  $text?: { $search: string };
}

/**
 * GET /api/menu
 * Fetch all menu items with optional query-based filtering
 *
 * @param req - Express request containing optional query parameters
 * @param res - Express response object
 *
 * Supported Query Parameters:
 * - chefSpecial: Filter menu items marked as chef's special ("true" | "false")
 *   Example: /api/menu?chefSpecial=true
 * - category: Filter by category identifier or name
 * - dietary: Filter by dietary tags (e.g., vegetarian, vegan)
 * - search: Full-text search across menu item names and descriptions
 * - available: Filter by availability status ("true" | "false")
 *
 * @returns
 * - Array of menu items sorted alphabetically by name
 */
export const getAllMenu = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { category, dietary, search, available, chefSpecial } = req.query;
    const filter: FilterConditions = {};

    if (category) filter.category = category as string;
    if (dietary) filter.dietaryTags = dietary as string;
    if (available !== undefined) filter.availability = available === "true";

    if (chefSpecial !== undefined) {
      filter.chefSpecial = chefSpecial === "true";
    }

    if (search) {
      filter.$text = { $search: search as string };
    }

    const menuItems = await MenuItem.find(filter)
      .populate("category", "name")
      .sort({ name: 1 });

    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

/**
 * GET /api/menu/:id
 * Fetch a single menu item by its unique identifier
 *
 * @param req - Express request containing menu item ID in URL params
 * @param res - Express response object
 *
 * URL Parameters:
 * - id: Menu item MongoDB ObjectId
 *
 * @returns
 * - Menu item document with populated category information
 * - 404 error if item does not exist
 */
export const getMenuId = async (req: Request, res: Response): Promise<void> => {
  try {
    const menuItem = await MenuItem.findById(req.params.id).populate(
      "category",
      "name description",
    );

    if (!menuItem) {
      res.status(404).json({ message: "Menu item not found" });
      return;
    }

    res.json(menuItem);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

/**
 * POST /api/menu
 * Create a new menu item
 *
 * @param req - Express request containing menu item data in request body
 * @param res - Express response object
 *
 * Request Body:
 * - name: string (required)
 * - description: string
 * - price: number (required)
 * - category: Category name or ObjectId
 * - dietaryTags: string[]
 * - availability: boolean
 * - imageUrl: string
 *
 * Behavior:
 * - Automatically creates a category if the provided category name does not exist
 * - Converts category name to ObjectId before saving
 *
 * @returns
 * - Newly created menu item with populated category data
 */
export const createMenu = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Handle category name to ObjectId conversion
    if (req.body.category && typeof req.body.category === "string") {
      let category = await Category.findOne({ name: req.body.category });

      if (!category) {
        // Create category if it does not exist
        category = new Category({ name: req.body.category });
        await category.save();
      }

      req.body.category = category._id;
    }

    const menuItem: IMenuItem = new MenuItem(req.body);
    const savedItem = await menuItem.save();
    await savedItem.populate("category", "name");

    res.status(201).json(savedItem);
  } catch (error) {
    res.status(400).json({ message: "Error creating menu item", error });
  }
};

/**
 * PUT /api/menu/:id
 * Update an existing menu item by ID
 *
 * @param req - Express request containing menu item ID and updated data
 * @param res - Express response object
 *
 * URL Parameters:
 * - id: Menu item MongoDB ObjectId
 *
 * Request Body:
 * - Full or partial menu item data following IMenuItem interface
 *
 * Behavior:
 * - Converts category name to ObjectId if necessary
 * - Runs schema validators during update
 *
 * @returns
 * - Updated menu item with populated category
 * - 404 error if menu item does not exist
 */
export const updateMenu = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Handle category name to ObjectId conversion
    if (req.body.category && typeof req.body.category === "string") {
      let category = await Category.findOne({ name: req.body.category });

      if (!category) {
        category = new Category({ name: req.body.category });
        await category.save();
      }

      req.body.category = category._id;
    }

    const menuItem = await MenuItem.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("category", "name");

    if (!menuItem) {
      res.status(404).json({ message: "Menu item not found" });
      return;
    }

    res.json(menuItem);
  } catch (error) {
    res.status(400).json({ message: "Error updating menu item", error });
  }
};

/**
 * DELETE /api/menu/:id
 * Remove a menu item from the system
 *
 * @param req - Express request containing menu item ID
 * @param res - Express response object
 *
 * URL Parameters:
 * - id: Menu item MongoDB ObjectId
 *
 * @returns
 * - Success message upon deletion
 * - 404 error if menu item does not exist
 */
export const deleteMenuItem = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const menuItem = await MenuItem.findByIdAndDelete(req.params.id);

    if (!menuItem) {
      res.status(404).json({ message: "Menu item not found" });
      return;
    }

    res.json({ message: "Menu item deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
