import express from "express";
import {
  getRatingStatistics,
  getMenuItemRatings,
  getUserRatingHistory,
  getRatingDistribution,
  getTopRatedItems,
  getLowestRatedItems,
  getRatingTrends,
  compareItemRatings,
  getAverageRatingByCategory,
  getRatingAnalytics,
} from "../../../controllers/ratingController";

const router = express.Router();

/**
 * RATING ROUTES
 *
 * Base URL: /api/ratings
 *
 * Route Structure:
 * GET     /statistics         - Get overall rating statistics
 * GET     /distribution       - Get rating distribution (1-5 stars breakdown)
 * GET     /menu-item/:id      - Get all ratings for a specific menu item
 * GET     /user/:id           - Get rating history for a specific user
 * GET     /top-rated          - Get highest rated menu items
 * GET     /lowest-rated       - Get lowest rated menu items
 * GET     /trends             - Get rating trends over time
 * GET     /compare            - Compare ratings between menu items
 * GET     /by-category        - Get average ratings grouped by category
 * GET     /analytics          - Get comprehensive rating analytics
 */

// Get overall rating statistics
router.get("/statistics", getRatingStatistics);

// Get rating distribution (how many 1-star, 2-star, etc.)
router.get("/distribution", getRatingDistribution);

// Get all ratings for a specific menu item
router.get("/menu-item/:id", getMenuItemRatings);

// Get rating history for a specific user
router.get("/user/:id", getUserRatingHistory);

// Get top-rated menu items
router.get("/top-rated", getTopRatedItems);

// Get lowest-rated menu items
router.get("/lowest-rated", getLowestRatedItems);

// Get rating trends over time
router.get("/trends", getRatingTrends);

// Compare ratings between multiple menu items
router.get("/compare", compareItemRatings);

// Get average ratings grouped by menu item category
router.get("/by-category", getAverageRatingByCategory);

// Get comprehensive rating analytics
router.get("/analytics", getRatingAnalytics);

export default router;
