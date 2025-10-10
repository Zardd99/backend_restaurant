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
 * Retrieve all menu items with optional filtering by chefSpecial, category, dietary tags, availability, and search text
 *
 * @param req - Express Request object with query parameters
 * @param res - Express Response object
 *
 * Query Parameters:
 * - chefSpecial: Filter by chef special status (true/false) , menu?chefSpecial=true
 * - category: Filter by category name
 * - dietary: Filter by dietary tags
 * - search: Text search across menu item names and descriptions
 * - available: Filter by availability status (true/false)
 *
 * @returns JSON response with array of menu items or error message
 */
export const getAllMenu = async (
  req: Request,
  res: Response
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
 * Retrieve a single menu item by ID with populated category information
 *
 * @param req - Express Request object with ID parameter
 * @param res - Express Response object
 *
 * URL Parameters:
 * - id: Menu item ID (MongoDB ObjectId)
 *
 * @returns JSON response with menu item details or error message
 */

export const getMenuId = async (req: Request, res: Response): Promise<void> => {
  try {
    const menuItem = await MenuItem.findById(req.params.id).populate(
      "category",
      "name description"
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
 * Create a new menu item in the database
 *
 * @param req - Express Request object with menu item data in body
 * @param res - Express Response object
 *
 * Request Body: Complete menu item data following IMenuItem interface
 * - name: string (required)
 * - description: string
 * - price: number (required)
 * - category: ObjectId
 * - dietaryTags: string[]
 * - availability: boolean
 * - imageUrl: string
 *
 * @returns JSON response with created menu item or error message
 */
export const createMenu = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Handle category name to ObjectId conversion
    if (req.body.category && typeof req.body.category === "string") {
      let category = await Category.findOne({ name: req.body.category });

      if (!category) {
        // Create new category if it doesn't exist
        category = new Category({ name: req.body.category });
        await category.save();
      }

      // Replace category name with ObjectId
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
 * Update an existing menu item by ID with complete data replacement
 *
 * @param req - Express Request object with ID parameter and update data in body
 * @param res - Express Response object
 *
 * URL Parameters:
 * - id: Menu item ID (MongoDB ObjectId)
 *
 * Request Body: Complete menu item data following IMenuItem interface
 *
 * @returns JSON response with updated menu item or error message
 */
export const updateMenu = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Handle category name to ObjectId conversion
    if (req.body.category && typeof req.body.category === "string") {
      let category = await Category.findOne({ name: req.body.category });

      if (!category) {
        // Create new category if it doesn't exist
        category = new Category({ name: req.body.category });
        await category.save();
      }

      // Replace category name with ObjectId
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
 * Deletes a menuItem by ID
 *
 * URL Parameters:
 * - id: menuItem ID to delete
 *
 * Response: Returns deleted review data
 */
export const deleteMenuItem = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const menuItem = await MenuItem.findByIdAndDelete(req.params.id);

    if (!menuItem) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
