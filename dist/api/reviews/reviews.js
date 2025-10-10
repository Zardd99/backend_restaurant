"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const reviewController_1 = require("../../controllers/reviewController");
const router = express_1.default.Router();
router.get("/", reviewController_1.getAllReviews);
router.get("/paginated", reviewController_1.getReviewsWithPagination);
router.get("/rating-range", reviewController_1.getReviewsByRatingRange);
router.get("/:id", reviewController_1.getReviewById);
router.post("/", reviewController_1.createReview);
router.put("/:id", reviewController_1.updateReview);
router.delete("/:id", reviewController_1.deleteReview);
router.post("/bulk-delete", reviewController_1.bulkDeleteReviews);
exports.default = router;
//# sourceMappingURL=reviews.js.map