"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ratingController_1 = require("../../../controllers/ratingController");
const router = express_1.default.Router();
router.get("/statistics", ratingController_1.getRatingStatistics);
router.get("/distribution", ratingController_1.getRatingDistribution);
router.get("/menu-item/:id", ratingController_1.getMenuItemRatings);
router.get("/user/:id", ratingController_1.getUserRatingHistory);
router.get("/top-rated", ratingController_1.getTopRatedItems);
router.get("/lowest-rated", ratingController_1.getLowestRatedItems);
router.get("/trends", ratingController_1.getRatingTrends);
router.get("/compare", ratingController_1.compareItemRatings);
router.get("/by-category", ratingController_1.getAverageRatingByCategory);
router.get("/analytics", ratingController_1.getRatingAnalytics);
exports.default = router;
//# sourceMappingURL=rating.js.map