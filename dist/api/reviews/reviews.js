"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const reviewController_1 = require("../../controllers/reviewController");
const auth_1 = require("../../middleware/auth");
const router = express_1.default.Router();
router.get("/", reviewController_1.getAllReviews);
router.get("/paginated", reviewController_1.getReviewsWithPagination);
router.get("/rating-range", reviewController_1.getReviewsByRatingRange);
router.get("/:id", reviewController_1.getReviewById);
router.post("/", auth_1.authenticate, (0, auth_1.requirePermission)("review:write"), reviewController_1.createReview);
router.put("/:id", auth_1.authenticate, (0, auth_1.requirePermission)("review:write"), reviewController_1.updateReview);
router.delete("/:id", auth_1.authenticate, (0, auth_1.requirePermission)("review:read"), reviewController_1.deleteReview);
router.post("/bulk-delete", auth_1.authenticate, (0, auth_1.requirePermission)("review:read"), reviewController_1.bulkDeleteReviews);
exports.default = router;
//# sourceMappingURL=reviews.js.map