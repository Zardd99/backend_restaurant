import { Request, Response } from "express";
import { Types } from "mongoose";
import Review, { IReview } from "../models/Review";

/**
 * Interface defining the possible filter conditions for querying reviews
 * All fields are optional to support flexible filtering
 */
interface FilterConditions {
  user?: Types.ObjectId;
  menuItem?: Types.ObjectId;
  rating?: number;
  comment?: RegExp | string;
  date?:
    | {
        $gte?: Date;
        $lte?: Date;
      }
    | Date;
}

/**
 * GET /api/reviews
 * Retrieves all reviews with optional filtering, sorting, and population of related data
 *
 * Query Parameters:
 * - user: Filter by user ID
 * - menuItem: Filter by menu item ID
 * - rating: Filter by exact rating
 * - comment: Partial text search in comments (case-insensitive)
 * - date: Filter by exact date
 * - dateFrom: Start date for date range filter
 * - dateTo: End date for date range filter
 *
 * Response: Returns paginated list of reviews with populated user and menuItem data
 */
export const getAllReviews = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { user, menuItem, rating, date, comment, dateFrom, dateTo } =
      req.query;
    const filter: FilterConditions = {};

    // Filter by user ID with ObjectId validation
    if (user && Types.ObjectId.isValid(user as string)) {
      filter.user = new Types.ObjectId(user as string);
    }

    // Filter by menu item ID with ObjectId validation
    if (menuItem && Types.ObjectId.isValid(menuItem as string)) {
      filter.menuItem = new Types.ObjectId(menuItem as string);
    }

    // Filter by exact rating value
    if (rating) {
      filter.rating = Number(rating);
    }

    if (comment) {
      filter.comment = new RegExp(comment as string, "i");
    }

    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) {
        filter.date.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        filter.date.$lte = new Date(dateTo as string);
      }
    } else if (date) {
      const queryDate = new Date(date as string);
      const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));
      filter.date = { $gte: startOfDay, $lte: endOfDay };
    }

    // Execute query with population of related data and sort
    const reviews = await Review.find(filter)
      // Include user name and email
      .populate("user", "name email")
      // Include menu item details
      .populate("menuItem", "name price category")
      // Sort by most recent first
      .sort({ date: -1 });

    res.json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    console.error("Error in getAllReviews:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};

/**
 * GET /api/reviews/:id
 * Retrieves a single review by its ID with populated related data
 *
 * URL Parameters:
 * - id: Review ID (MongoDB ObjectId)
 *
 * Response: Returns review details with populated user and menuItem data
 */
export const getReviewById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({
        success: false,
        message: "Invalid review ID format",
      });
      return;
    }

    const review = await Review.findById(req.params.id)
      .populate("user", "name email")
      .populate("menuItem", "name price category description");

    if (!review) {
      res.status(404).json({
        success: false,
        message: "Review not found",
      });
      return;
    }

    res.json({
      success: true,
      data: review,
    });
  } catch (error) {
    console.error("Error in getReviewById:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};

/**
 * GET /api/reviews/rating/range
 * Retrieves reviews within a specific rating range
 *
 * Query Parameters:
 * - minRating: Minimum rating value (default: 1)
 * - maxRating: Maximum rating value (default: 5)
 *
 * Response: Returns reviews filtered by rating range with populated data
 */
export const getReviewsByRatingRange = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { minRating = 1, maxRating = 5 } = req.query;

    const reviews = await Review.find({
      rating: {
        $gte: Number(minRating),
        $lte: Number(maxRating),
      },
    })
      .populate("user", "name")
      .populate("menuItem", "name")
      .sort({ rating: -1, date: -1 });

    res.json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};

/**
 * GET /api/reviews/paginated
 * Retrieves reviews with pagination support
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Number of items per page (default: 10)
 * - user: Filter by user ID
 * - menuItem: Filter by menu item ID
 * - rating: Filter by exact rating
 *
 * Response: Returns paginated results with pagination metadata
 */
export const getReviewsWithPagination = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const { user, menuItem, rating } = req.query;
    const filter: FilterConditions = {};

    // Apply filters if provided
    if (user && Types.ObjectId.isValid(user as string)) {
      filter.user = new Types.ObjectId(user as string);
    }
    if (menuItem && Types.ObjectId.isValid(menuItem as string)) {
      filter.menuItem = new Types.ObjectId(menuItem as string);
    }
    if (rating) filter.rating = Number(rating);

    // Execute paginated query
    const reviews = await Review.find(filter)
      .populate("user", "name email")
      .populate("menuItem", "name price")
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination metadata
    const total = await Review.countDocuments(filter);

    res.json({
      success: true,
      data: reviews,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};

/**
 * POST /api/reviews
 * Creates a new review with validation and duplicate checking
 *
 * Request Body:
 * - user: User ID (required)
 * - menuItem: Menu item ID (required)
 * - rating: Rating value 1-5 (required)
 * - comment: Review comment (optional)
 *
 * Response: Returns created review with populated data
 */
export const createReview = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { user, menuItem, rating, comment } = req.body;

    if (!user || !menuItem || !rating) {
      res.status(400).json({
        success: false,
        message: "User, menuItem, and rating are required fields",
      });
      return;
    }

    if (!Types.ObjectId.isValid(user) || !Types.ObjectId.isValid(menuItem)) {
      res.status(400).json({
        success: false,
        message: "Invalid user or menuItem ID format",
      });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
      return;
    }

    // Check for existing review by same user for same menu item
    const existingReview = await Review.findOne({
      user: new Types.ObjectId(user),
      menuItem: new Types.ObjectId(menuItem),
    });

    if (existingReview) {
      res.status(409).json({
        success: false,
        message: "You have already reviewed this menu item",
      });
      return;
    }

    // Create new review
    const newReview = new Review({
      user: new Types.ObjectId(user),
      menuItem: new Types.ObjectId(menuItem),
      rating: Number(rating),
      comment: comment || "",
      date: new Date(),
    });

    // Save to database
    const savedReview = await newReview.save();

    const populatedReview = await Review.findById(savedReview._id)
      .populate("user", "name email")
      .populate("menuItem", "name price category");

    res.status(201).json({
      success: true,
      message: "Review created successfully",
      data: populatedReview,
    });
  } catch (error: unknown) {
    console.error("Error in createReview:", error);

    const mongoError = error as MongoValidationError;
    if (mongoError.name === "ValidationError") {
      const validationErrors = mongoError.errors
        ? Object.values(mongoError.errors).map((err) => err.message)
        : ["Validation failed"];
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
      return;
    }

    if (mongoError.code === 11000) {
      res.status(409).json({
        success: false,
        message: "You have already reviewed this menu item",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? mongoError : {},
    });
  }
};

/**
 * PUT /api/reviews/:id
 * Updates an existing review with validation
 *
 * URL Parameters:
 * - id: Review ID to update
 *
 * Request Body:
 * - rating: New rating value (optional)
 * - comment: New comment text (optional)
 *
 * Response: Returns updated review with populated data
 */
export const updateReview = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid review ID format",
      });
      return;
    }

    if (rating !== undefined && (rating < 1 || rating > 5)) {
      res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
      return;
    }

    const existingReview = await Review.findById(id);
    if (!existingReview) {
      res.status(404).json({
        success: false,
        message: "Review not found",
      });
      return;
    }

    const updateData: Partial<IReview> = {};
    if (rating !== undefined) updateData.rating = Number(rating);
    if (comment !== undefined) updateData.comment = comment;

    // Perform update and return updated document
    const updatedReview = await Review.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("user", "name email")
      .populate("menuItem", "name price category");

    if (!updatedReview) {
      res.status(404).json({
        success: false,
        message: "Review not found",
      });
      return;
    }

    res.json({
      success: true,
      message: "Review updated successfully",
      data: updatedReview,
    });
  } catch (error: unknown) {
    console.error("Error in updateReview:", error);

    const mongoError = error as MongoValidationError;
    if (mongoError.name === "ValidationError") {
      const validationErrors = mongoError.errors
        ? Object.values(mongoError.errors).map((err) => err.message)
        : ["Validation failed"];
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? mongoError : {},
    });
  }
};

/**
 * DELETE /api/reviews/:id
 * Deletes a review by ID
 *
 * URL Parameters:
 * - id: Review ID to delete
 *
 * Response: Returns deleted review data
 */
export const deleteReview = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid review ID format",
      });
      return;
    }

    const deletedReview = await Review.findByIdAndDelete(id)
      .populate("user", "name email")
      .populate("menuItem", "name price category");

    if (!deletedReview) {
      res.status(404).json({
        success: false,
        message: "Review not found",
      });
      return;
    }

    res.json({
      success: true,
      message: "Review deleted successfully",
      data: deletedReview,
    });
  } catch (error) {
    console.error("Error in deleteReview:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};

/**
 * POST /api/reviews/bulk-delete
 * Deletes multiple reviews in a single operation (Admin functionality)
 *
 * Request Body:
 * - reviewIds: Array of review IDs to delete
 *
 * Response: Returns count of deleted reviews
 */
export const bulkDeleteReviews = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { reviewIds } = req.body;

    if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
      res.status(400).json({
        success: false,
        message: "reviewIds must be a non-empty array",
      });
      return;
    }

    const invalidIds = reviewIds.filter((id) => !Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      res.status(400).json({
        success: false,
        message: "Invalid review ID format",
        invalidIds,
      });
      return;
    }

    const result = await Review.deleteMany({
      _id: { $in: reviewIds.map((id) => new Types.ObjectId(id)) },
    });

    res.json({
      success: true,
      message: `${result.deletedCount} reviews deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error in bulkDeleteReviews:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};

interface MongoValidationError extends Error {
  errors?: { [path: string]: { message: string } };
  code?: number;
}
