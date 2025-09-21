import express from "express";
import {
  getAllReviews,
  getReviewById,
  getReviewsByRatingRange,
  getReviewsWithPagination,
  updateReview,
  createReview,
  deleteReview,
  bulkDeleteReviews,
} from "../../controllers/reviewController";

const router = express.Router();

/**
 * REVIEW ROUTES
 *
 * Base URL: /api/reviews
 *
 * Route Structure:
 * GET     /                   - Get all reviews with optional filtering
 * GET     /paginated          - Get reviews with pagination
 * GET     /rating-range       - Get reviews by rating range
 * GET     /:id                - Get single review by ID
 * POST    /                   - Create new review
 * PUT     /:id                - Update review by ID
 * DELETE  /:id                - Delete review by ID
 * POST    /bulk-delete        - Bulk delete reviews (Admin only)
 */

router.get("/", getAllReviews);
router.get("/paginated", getReviewsWithPagination);
router.get("/rating-range", getReviewsByRatingRange);
router.get("/:id", getReviewById);
router.post("/", createReview);
router.put("/:id", updateReview);
router.delete("/:id", deleteReview);
router.post("/bulk-delete", bulkDeleteReviews);

export default router;
