"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkDeleteReviews = exports.deleteReview = exports.updateReview = exports.createReview = exports.getReviewsWithPagination = exports.getReviewsByRatingRange = exports.getReviewById = exports.getAllReviews = void 0;
const mongoose_1 = require("mongoose");
const Review_1 = __importDefault(require("../models/Review"));
const getAllReviews = async (req, res) => {
    try {
        const { user, menuItem, rating, date, comment, dateFrom, dateTo } = req.query;
        const filter = {};
        if (user && mongoose_1.Types.ObjectId.isValid(user)) {
            filter.user = new mongoose_1.Types.ObjectId(user);
        }
        if (menuItem && mongoose_1.Types.ObjectId.isValid(menuItem)) {
            filter.menuItem = new mongoose_1.Types.ObjectId(menuItem);
        }
        if (rating) {
            filter.rating = Number(rating);
        }
        if (comment) {
            filter.comment = new RegExp(comment, "i");
        }
        if (dateFrom || dateTo) {
            filter.date = {};
            if (dateFrom) {
                filter.date.$gte = new Date(dateFrom);
            }
            if (dateTo) {
                filter.date.$lte = new Date(dateTo);
            }
        }
        else if (date) {
            const queryDate = new Date(date);
            const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
            const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));
            filter.date = { $gte: startOfDay, $lte: endOfDay };
        }
        const reviews = await Review_1.default.find(filter)
            .populate("user", "name email")
            .populate("menuItem", "name price category")
            .sort({ date: -1 });
        res.json({
            success: true,
            count: reviews.length,
            data: reviews,
        });
    }
    catch (error) {
        console.error("Error in getAllReviews:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: process.env.NODE_ENV === "development" ? error : {},
        });
    }
};
exports.getAllReviews = getAllReviews;
const getReviewById = async (req, res) => {
    try {
        if (!mongoose_1.Types.ObjectId.isValid(req.params.id)) {
            res.status(400).json({
                success: false,
                message: "Invalid review ID format",
            });
            return;
        }
        const review = await Review_1.default.findById(req.params.id)
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
    }
    catch (error) {
        console.error("Error in getReviewById:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: process.env.NODE_ENV === "development" ? error : {},
        });
    }
};
exports.getReviewById = getReviewById;
const getReviewsByRatingRange = async (req, res) => {
    try {
        const { minRating = 1, maxRating = 5 } = req.query;
        const reviews = await Review_1.default.find({
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: process.env.NODE_ENV === "development" ? error : {},
        });
    }
};
exports.getReviewsByRatingRange = getReviewsByRatingRange;
const getReviewsWithPagination = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const { user, menuItem, rating } = req.query;
        const filter = {};
        if (user && mongoose_1.Types.ObjectId.isValid(user)) {
            filter.user = new mongoose_1.Types.ObjectId(user);
        }
        if (menuItem && mongoose_1.Types.ObjectId.isValid(menuItem)) {
            filter.menuItem = new mongoose_1.Types.ObjectId(menuItem);
        }
        if (rating)
            filter.rating = Number(rating);
        const reviews = await Review_1.default.find(filter)
            .populate("user", "name email")
            .populate("menuItem", "name price")
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit);
        const total = await Review_1.default.countDocuments(filter);
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: process.env.NODE_ENV === "development" ? error : {},
        });
    }
};
exports.getReviewsWithPagination = getReviewsWithPagination;
const createReview = async (req, res) => {
    try {
        const { user, menuItem, rating, comment } = req.body;
        if (!user || !menuItem || !rating) {
            res.status(400).json({
                success: false,
                message: "User, menuItem, and rating are required fields",
            });
            return;
        }
        if (!mongoose_1.Types.ObjectId.isValid(user) || !mongoose_1.Types.ObjectId.isValid(menuItem)) {
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
        const existingReview = await Review_1.default.findOne({
            user: new mongoose_1.Types.ObjectId(user),
            menuItem: new mongoose_1.Types.ObjectId(menuItem),
        });
        if (existingReview) {
            res.status(409).json({
                success: false,
                message: "You have already reviewed this menu item",
            });
            return;
        }
        const newReview = new Review_1.default({
            user: new mongoose_1.Types.ObjectId(user),
            menuItem: new mongoose_1.Types.ObjectId(menuItem),
            rating: Number(rating),
            comment: comment || "",
            date: new Date(),
        });
        const savedReview = await newReview.save();
        const populatedReview = await Review_1.default.findById(savedReview._id)
            .populate("user", "name email")
            .populate("menuItem", "name price category");
        res.status(201).json({
            success: true,
            message: "Review created successfully",
            data: populatedReview,
        });
    }
    catch (error) {
        console.error("Error in createReview:", error);
        const mongoError = error;
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
exports.createReview = createReview;
const updateReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, comment } = req.body;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
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
        const existingReview = await Review_1.default.findById(id);
        if (!existingReview) {
            res.status(404).json({
                success: false,
                message: "Review not found",
            });
            return;
        }
        const updateData = {};
        if (rating !== undefined)
            updateData.rating = Number(rating);
        if (comment !== undefined)
            updateData.comment = comment;
        const updatedReview = await Review_1.default.findByIdAndUpdate(id, updateData, {
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
    }
    catch (error) {
        console.error("Error in updateReview:", error);
        const mongoError = error;
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
exports.updateReview = updateReview;
const deleteReview = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid review ID format",
            });
            return;
        }
        const deletedReview = await Review_1.default.findByIdAndDelete(id)
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
    }
    catch (error) {
        console.error("Error in deleteReview:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: process.env.NODE_ENV === "development" ? error : {},
        });
    }
};
exports.deleteReview = deleteReview;
const bulkDeleteReviews = async (req, res) => {
    try {
        const { reviewIds } = req.body;
        if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
            res.status(400).json({
                success: false,
                message: "reviewIds must be a non-empty array",
            });
            return;
        }
        const invalidIds = reviewIds.filter((id) => !mongoose_1.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
            res.status(400).json({
                success: false,
                message: "Invalid review ID format",
                invalidIds,
            });
            return;
        }
        const result = await Review_1.default.deleteMany({
            _id: { $in: reviewIds.map((id) => new mongoose_1.Types.ObjectId(id)) },
        });
        res.json({
            success: true,
            message: `${result.deletedCount} reviews deleted successfully`,
            deletedCount: result.deletedCount,
        });
    }
    catch (error) {
        console.error("Error in bulkDeleteReviews:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: process.env.NODE_ENV === "development" ? error : {},
        });
    }
};
exports.bulkDeleteReviews = bulkDeleteReviews;
//# sourceMappingURL=reviewController.js.map