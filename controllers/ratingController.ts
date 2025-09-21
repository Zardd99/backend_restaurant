import { Request, Response } from "express";
import { Types } from "mongoose";
import Review from "../models/Review";
import MenuItem from "../models/MenuItem";

/**
 * GET /api/ratings/statistics
 * Get overall rating statistics across all reviews
 *
 * Response: Returns comprehensive rating statistics
 */
export const getRatingStatistics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const stats = await Review.aggregate([
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$rating" },
          highestRating: { $max: "$rating" },
          lowestRating: { $min: "$rating" },
        },
      },
    ]);

    const ratingDistribution = await Review.aggregate([
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const result = stats[0] || {
      totalReviews: 0,
      averageRating: 0,
      highestRating: 0,
      lowestRating: 0,
    };

    res.json({
      success: true,
      data: {
        ...result,
        averageRating: parseFloat(result.averageRating?.toFixed(2) || "0"),
        ratingDistribution,
      },
    });
  } catch (error) {
    console.error("Error in getRatingStatistics:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};

/**
 * GET /api/ratings/distribution
 * Get rating distribution showing count of each rating (1-5 stars)
 *
 * Query Parameters:
 * - menuItem: Optional menu item ID to filter by
 * - dateFrom: Optional start date
 * - dateTo: Optional end date
 *
 * Response: Returns rating distribution data
 */
export const getRatingDistribution = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { menuItem, dateFrom, dateTo } = req.query;
    const matchFilter: any = {};

    // Add filters if provided
    if (menuItem && Types.ObjectId.isValid(menuItem as string)) {
      matchFilter.menuItem = new Types.ObjectId(menuItem as string);
    }

    if (dateFrom || dateTo) {
      matchFilter.date = {};
      if (dateFrom) matchFilter.date.$gte = new Date(dateFrom as string);
      if (dateTo) matchFilter.date.$lte = new Date(dateTo as string);
    }

    const pipeline = [];
    if (Object.keys(matchFilter).length > 0) {
      pipeline.push({ $match: matchFilter });
    }

    pipeline.push(
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 as 1 | -1 } }
    );

    const distribution = await Review.aggregate(pipeline);

    // Ensure all ratings 1-5 are represented
    const fullDistribution = Array.from({ length: 5 }, (_, i) => {
      const rating = i + 1;
      const found = distribution.find((d) => d._id === rating);
      return {
        rating,
        count: found ? found.count : 0,
      };
    });

    const totalReviews = fullDistribution.reduce(
      (sum, item) => sum + item.count,
      0
    );

    res.json({
      success: true,
      data: {
        distribution: fullDistribution,
        totalReviews,
      },
    });
  } catch (error) {
    console.error("Error in getRatingDistribution:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};

/**
 * GET /api/ratings/menu-item/:id
 * Get all ratings and statistics for a specific menu item
 *
 * URL Parameters:
 * - id: Menu item ID
 *
 * Response: Returns menu item rating data with statistics
 */
export const getMenuItemRatings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid menu item ID format",
      });
      return;
    }

    const menuItemId = new Types.ObjectId(id);

    // Get all reviews for this menu item
    const reviews = await Review.find({ menuItem: menuItemId })
      .populate("user", "name")
      .sort({ date: -1 });

    // Get rating statistics
    const stats = await Review.aggregate([
      { $match: { menuItem: menuItemId } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$rating" },
          highestRating: { $max: "$rating" },
          lowestRating: { $min: "$rating" },
        },
      },
    ]);

    // Get rating distribution for this item
    const distribution = await Review.aggregate([
      { $match: { menuItem: menuItemId } },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const menuItem = await MenuItem.findById(id, "name price category");

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
      return;
    }

    const statistics = stats[0] || {
      totalReviews: 0,
      averageRating: 0,
      highestRating: 0,
      lowestRating: 0,
    };

    res.json({
      success: true,
      data: {
        menuItem,
        reviews,
        statistics: {
          ...statistics,
          averageRating: parseFloat(
            statistics.averageRating?.toFixed(2) || "0"
          ),
        },
        distribution,
      },
    });
  } catch (error) {
    console.error("Error in getMenuItemRatings:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};

/**
 * GET /api/ratings/user/:id
 * Get rating history for a specific user
 *
 * URL Parameters:
 * - id: User ID
 *
 * Response: Returns user's rating history with statistics
 */
export const getUserRatingHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
      return;
    }

    const userId = new Types.ObjectId(id);

    // Get all reviews by this user
    const reviews = await Review.find({ user: userId })
      .populate("menuItem", "name price category")
      .sort({ date: -1 });

    // Get user rating statistics
    const stats = await Review.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$rating" },
          highestRating: { $max: "$rating" },
          lowestRating: { $min: "$rating" },
        },
      },
    ]);

    const statistics = stats[0] || {
      totalReviews: 0,
      averageRating: 0,
      highestRating: 0,
      lowestRating: 0,
    };

    res.json({
      success: true,
      data: {
        reviews,
        statistics: {
          ...statistics,
          averageRating: parseFloat(
            statistics.averageRating?.toFixed(2) || "0"
          ),
        },
      },
    });
  } catch (error) {
    console.error("Error in getUserRatingHistory:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};

/**
 * GET /api/ratings/top-rated
 * Get highest rated menu items
 *
 * Query Parameters:
 * - limit: Number of items to return (default: 10)
 * - minReviews: Minimum number of reviews required (default: 1)
 *
 * Response: Returns top-rated menu items with their ratings
 */
export const getTopRatedItems = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const minReviews = parseInt(req.query.minReviews as string) || 1;

    const topRated = await Review.aggregate([
      {
        $group: {
          _id: "$menuItem",
          averageRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 },
        },
      },
      { $match: { reviewCount: { $gte: minReviews } } },
      { $sort: { averageRating: -1, reviewCount: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "menuitems",
          localField: "_id",
          foreignField: "_id",
          as: "menuItem",
        },
      },
      { $unwind: "$menuItem" },
      {
        $project: {
          menuItem: {
            _id: "$menuItem._id",
            name: "$menuItem.name",
            price: "$menuItem.price",
            category: "$menuItem.category",
          },
          averageRating: { $round: ["$averageRating", 2] },
          reviewCount: 1,
        },
      },
    ]);

    res.json({
      success: true,
      count: topRated.length,
      data: topRated,
    });
  } catch (error) {
    console.error("Error in getTopRatedItems:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};

/**
 * GET /api/ratings/lowest-rated
 * Get lowest rated menu items
 *
 * Query Parameters:
 * - limit: Number of items to return (default: 10)
 * - minReviews: Minimum number of reviews required (default: 1)
 *
 * Response: Returns lowest-rated menu items with their ratings
 */
export const getLowestRatedItems = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const minReviews = parseInt(req.query.minReviews as string) || 1;

    const lowestRated = await Review.aggregate([
      {
        $group: {
          _id: "$menuItem",
          averageRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 },
        },
      },
      { $match: { reviewCount: { $gte: minReviews } } },
      { $sort: { averageRating: 1, reviewCount: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "menuitems",
          localField: "_id",
          foreignField: "_id",
          as: "menuItem",
        },
      },
      { $unwind: "$menuItem" },
      {
        $project: {
          menuItem: {
            _id: "$menuItem._id",
            name: "$menuItem.name",
            price: "$menuItem.price",
            category: "$menuItem.category",
          },
          averageRating: { $round: ["$averageRating", 2] },
          reviewCount: 1,
        },
      },
    ]);

    res.json({
      success: true,
      count: lowestRated.length,
      data: lowestRated,
    });
  } catch (error) {
    console.error("Error in getLowestRatedItems:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};

/**
 * GET /api/ratings/trends
 * Get rating trends over time
 *
 * Query Parameters:
 * - period: Time period ('day', 'week', 'month') - default: 'day'
 * - days: Number of days to look back (default: 30)
 *
 * Response: Returns rating trends data
 */
export const getRatingTrends = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const period = (req.query.period as string) || "day";
    const days = parseInt(req.query.days as string) || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build the $group stage with consistent structure
    const groupStage: Record<string, any> = {
      _id: {
        $dateToString: { format: "%Y-%m-%d", date: "$date" },
      },
      averageRating: { $avg: "$rating" },
      reviewCount: { $sum: 1 },
      date: { $first: "$date" },
    };

    switch (period) {
      case "week":
        groupStage._id = { $week: "$date" };
        break;
      case "month":
        groupStage._id = { $month: "$date" };
        break;
    }

    const trends = await Review.aggregate([
      { $match: { date: { $gte: startDate } } },
      { $group: groupStage },
      { $sort: { date: 1 } },
      {
        $project: {
          period: "$_id",
          averageRating: { $round: ["$averageRating", 2] },
          reviewCount: 1,
          date: 1,
          _id: 0,
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        trends,
        period,
        daysAnalyzed: days,
      },
    });
  } catch (error) {
    console.error("Error in getRatingTrends:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};

/**
 * GET /api/ratings/compare
 * Compare ratings between multiple menu items
 *
 * Query Parameters:
 * - items: Comma-separated list of menu item IDs
 *
 * Response: Returns comparison data for specified menu items
 */
export const compareItemRatings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { items } = req.query;

    if (!items) {
      res.status(400).json({
        success: false,
        message: "Items parameter is required (comma-separated menu item IDs)",
      });
      return;
    }

    const itemIds = (items as string)
      .split(",")
      .map((id) => id.trim())
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (itemIds.length === 0) {
      res.status(400).json({
        success: false,
        message: "No valid menu item IDs provided",
      });
      return;
    }

    const comparison = await Review.aggregate([
      { $match: { menuItem: { $in: itemIds } } },
      {
        $group: {
          _id: "$menuItem",
          averageRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 },
          ratings: { $push: "$rating" },
        },
      },
      {
        $lookup: {
          from: "menuitems",
          localField: "_id",
          foreignField: "_id",
          as: "menuItem",
        },
      },
      { $unwind: "$menuItem" },
      {
        $project: {
          menuItem: {
            _id: "$menuItem._id",
            name: "$menuItem.name",
            price: "$menuItem.price",
            category: "$menuItem.category",
          },
          averageRating: { $round: ["$averageRating", 2] },
          reviewCount: 1,
          ratings: 1,
        },
      },
      { $sort: { averageRating: -1 } },
    ]);

    res.json({
      success: true,
      count: comparison.length,
      data: comparison,
    });
  } catch (error) {
    console.error("Error in compareItemRatings:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};

/**
 * GET /api/ratings/by-category
 * Get average ratings grouped by menu item category
 *
 * Response: Returns average ratings for each category
 */
export const getAverageRatingByCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const categoryRatings = await Review.aggregate([
      {
        $lookup: {
          from: "menuitems",
          localField: "menuItem",
          foreignField: "_id",
          as: "menuItemData",
        },
      },
      { $unwind: "$menuItemData" },
      {
        $group: {
          _id: "$menuItemData.category",
          averageRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 },
          itemCount: { $addToSet: "$menuItem" },
        },
      },
      {
        $project: {
          category: "$_id",
          averageRating: { $round: ["$averageRating", 2] },
          reviewCount: 1,
          itemCount: { $size: "$itemCount" },
          _id: 0,
        },
      },
      { $sort: { averageRating: -1 } },
    ]);

    res.json({
      success: true,
      count: categoryRatings.length,
      data: categoryRatings,
    });
  } catch (error) {
    console.error("Error in getAverageRatingByCategory:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};

/**
 * GET /api/ratings/analytics
 * Get comprehensive rating analytics
 *
 * Response: Returns detailed analytics dashboard data
 */
export const getRatingAnalytics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Overall statistics
    const overallStats = await Review.aggregate([
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$rating" },
          highestRating: { $max: "$rating" },
          lowestRating: { $min: "$rating" },
        },
      },
    ]);

    // Rating distribution
    const distribution = await Review.aggregate([
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivity = await Review.aggregate([
      { $match: { date: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          reviewCount: { $sum: 1 },
          averageRating: { $avg: "$rating" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Top categories
    const topCategories = await Review.aggregate([
      {
        $lookup: {
          from: "menuitems",
          localField: "menuItem",
          foreignField: "_id",
          as: "menuItemData",
        },
      },
      { $unwind: "$menuItemData" },
      {
        $group: {
          _id: "$menuItemData.category",
          averageRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 },
        },
      },
      { $sort: { averageRating: -1 } },
      { $limit: 5 },
    ]);

    const stats = overallStats[0] || {
      totalReviews: 0,
      averageRating: 0,
      highestRating: 0,
      lowestRating: 0,
    };

    res.json({
      success: true,
      data: {
        overview: {
          ...stats,
          averageRating: parseFloat(stats.averageRating?.toFixed(2) || "0"),
        },
        distribution: distribution.map((d) => ({
          rating: d._id,
          count: d.count,
        })),
        recentActivity: recentActivity.map((activity) => ({
          date: activity._id,
          reviewCount: activity.reviewCount,
          averageRating: parseFloat(activity.averageRating?.toFixed(2) || "0"),
        })),
        topCategories: topCategories.map((cat) => ({
          category: cat._id,
          averageRating: parseFloat(cat.averageRating?.toFixed(2) || "0"),
          reviewCount: cat.reviewCount,
        })),
      },
    });
  } catch (error) {
    console.error("Error in getRatingAnalytics:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
};
