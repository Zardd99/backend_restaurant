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
import { authenticate, requirePermission } from "../../middleware/auth";

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

// Reading reviews is public.
router.get("/", getAllReviews);
router.get("/paginated", getReviewsWithPagination);
router.get("/rating-range", getReviewsByRatingRange);
router.get("/:id", getReviewById);

// Writing a review requires an authenticated user.
router.post("/", authenticate, requirePermission("review:write"), createReview);
router.put("/:id", authenticate, requirePermission("review:write"), updateReview);

// Removing reviews is moderation — admin/manager only.
router.delete(
  "/:id",
  authenticate,
  requirePermission("review:read"),
  deleteReview,
);
router.post(
  "/bulk-delete",
  authenticate,
  requirePermission("review:read"),
  bulkDeleteReviews,
);

export default router;
