"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRatingAnalytics = exports.getAverageRatingByCategory = exports.compareItemRatings = exports.getRatingTrends = exports.getLowestRatedItems = exports.getTopRatedItems = exports.getUserRatingHistory = exports.getMenuItemRatings = exports.getRatingDistribution = exports.getRatingStatistics = void 0;
const mongoose_1 = require("mongoose");
const Review_1 = __importDefault(require("../models/Review"));
const MenuItem_1 = __importDefault(require("../models/MenuItem"));
const getRatingStatistics = async (req, res) => {
    var _a;
    try {
        const stats = await Review_1.default.aggregate([
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
        const ratingDistribution = await Review_1.default.aggregate([
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
            data: Object.assign(Object.assign({}, result), { averageRating: parseFloat(((_a = result.averageRating) === null || _a === void 0 ? void 0 : _a.toFixed(2)) || "0"), ratingDistribution }),
        });
    }
    catch (error) {
        console.error("Error in getRatingStatistics:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: process.env.NODE_ENV === "development" ? error : {},
        });
    }
};
exports.getRatingStatistics = getRatingStatistics;
const getRatingDistribution = async (req, res) => {
    try {
        const { menuItem, dateFrom, dateTo } = req.query;
        const matchFilter = {};
        if (menuItem && mongoose_1.Types.ObjectId.isValid(menuItem)) {
            matchFilter.menuItem = new mongoose_1.Types.ObjectId(menuItem);
        }
        if (dateFrom || dateTo) {
            matchFilter.date = {};
            if (dateFrom)
                matchFilter.date.$gte = new Date(dateFrom);
            if (dateTo)
                matchFilter.date.$lte = new Date(dateTo);
        }
        const pipeline = [];
        if (Object.keys(matchFilter).length > 0) {
            pipeline.push({ $match: matchFilter });
        }
        pipeline.push({
            $group: {
                _id: "$rating",
                count: { $sum: 1 },
            },
        }, { $sort: { _id: 1 } });
        const distribution = await Review_1.default.aggregate(pipeline);
        const fullDistribution = Array.from({ length: 5 }, (_, i) => {
            const rating = i + 1;
            const found = distribution.find((d) => d._id === rating);
            return {
                rating,
                count: found ? found.count : 0,
            };
        });
        const totalReviews = fullDistribution.reduce((sum, item) => sum + item.count, 0);
        res.json({
            success: true,
            data: {
                distribution: fullDistribution,
                totalReviews,
            },
        });
    }
    catch (error) {
        console.error("Error in getRatingDistribution:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: process.env.NODE_ENV === "development" ? error : {},
        });
    }
};
exports.getRatingDistribution = getRatingDistribution;
const getMenuItemRatings = async (req, res) => {
    var _a;
    try {
        const { id } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid menu item ID format",
            });
            return;
        }
        const menuItemId = new mongoose_1.Types.ObjectId(id);
        const reviews = await Review_1.default.find({ menuItem: menuItemId })
            .populate("user", "name")
            .sort({ date: -1 });
        const stats = await Review_1.default.aggregate([
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
        const distribution = await Review_1.default.aggregate([
            { $match: { menuItem: menuItemId } },
            {
                $group: {
                    _id: "$rating",
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        const menuItem = await MenuItem_1.default.findById(id, "name price category");
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
                statistics: Object.assign(Object.assign({}, statistics), { averageRating: parseFloat(((_a = statistics.averageRating) === null || _a === void 0 ? void 0 : _a.toFixed(2)) || "0") }),
                distribution,
            },
        });
    }
    catch (error) {
        console.error("Error in getMenuItemRatings:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: process.env.NODE_ENV === "development" ? error : {},
        });
    }
};
exports.getMenuItemRatings = getMenuItemRatings;
const getUserRatingHistory = async (req, res) => {
    var _a;
    try {
        const { id } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid user ID format",
            });
            return;
        }
        const userId = new mongoose_1.Types.ObjectId(id);
        const reviews = await Review_1.default.find({ user: userId })
            .populate("menuItem", "name price category")
            .sort({ date: -1 });
        const stats = await Review_1.default.aggregate([
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
                statistics: Object.assign(Object.assign({}, statistics), { averageRating: parseFloat(((_a = statistics.averageRating) === null || _a === void 0 ? void 0 : _a.toFixed(2)) || "0") }),
            },
        });
    }
    catch (error) {
        console.error("Error in getUserRatingHistory:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: process.env.NODE_ENV === "development" ? error : {},
        });
    }
};
exports.getUserRatingHistory = getUserRatingHistory;
const getTopRatedItems = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const minReviews = parseInt(req.query.minReviews) || 1;
        const topRated = await Review_1.default.aggregate([
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
    }
    catch (error) {
        console.error("Error in getTopRatedItems:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: process.env.NODE_ENV === "development" ? error : {},
        });
    }
};
exports.getTopRatedItems = getTopRatedItems;
const getLowestRatedItems = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const minReviews = parseInt(req.query.minReviews) || 1;
        const lowestRated = await Review_1.default.aggregate([
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
    }
    catch (error) {
        console.error("Error in getLowestRatedItems:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: process.env.NODE_ENV === "development" ? error : {},
        });
    }
};
exports.getLowestRatedItems = getLowestRatedItems;
const getRatingTrends = async (req, res) => {
    try {
        const period = req.query.period || "day";
        const days = parseInt(req.query.days) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const groupStage = {
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
        const trends = await Review_1.default.aggregate([
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
    }
    catch (error) {
        console.error("Error in getRatingTrends:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: process.env.NODE_ENV === "development" ? error : {},
        });
    }
};
exports.getRatingTrends = getRatingTrends;
const compareItemRatings = async (req, res) => {
    try {
        const { items } = req.query;
        if (!items) {
            res.status(400).json({
                success: false,
                message: "Items parameter is required (comma-separated menu item IDs)",
            });
            return;
        }
        const itemIds = items
            .split(",")
            .map((id) => id.trim())
            .filter((id) => mongoose_1.Types.ObjectId.isValid(id))
            .map((id) => new mongoose_1.Types.ObjectId(id));
        if (itemIds.length === 0) {
            res.status(400).json({
                success: false,
                message: "No valid menu item IDs provided",
            });
            return;
        }
        const comparison = await Review_1.default.aggregate([
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
    }
    catch (error) {
        console.error("Error in compareItemRatings:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: process.env.NODE_ENV === "development" ? error : {},
        });
    }
};
exports.compareItemRatings = compareItemRatings;
const getAverageRatingByCategory = async (req, res) => {
    try {
        const categoryRatings = await Review_1.default.aggregate([
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
    }
    catch (error) {
        console.error("Error in getAverageRatingByCategory:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: process.env.NODE_ENV === "development" ? error : {},
        });
    }
};
exports.getAverageRatingByCategory = getAverageRatingByCategory;
const getRatingAnalytics = async (req, res) => {
    var _a;
    try {
        const overallStats = await Review_1.default.aggregate([
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
        const distribution = await Review_1.default.aggregate([
            {
                $group: {
                    _id: "$rating",
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentActivity = await Review_1.default.aggregate([
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
        const topCategories = await Review_1.default.aggregate([
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
                overview: Object.assign(Object.assign({}, stats), { averageRating: parseFloat(((_a = stats.averageRating) === null || _a === void 0 ? void 0 : _a.toFixed(2)) || "0") }),
                distribution: distribution.map((d) => ({
                    rating: d._id,
                    count: d.count,
                })),
                recentActivity: recentActivity.map((activity) => {
                    var _a;
                    return ({
                        date: activity._id,
                        reviewCount: activity.reviewCount,
                        averageRating: parseFloat(((_a = activity.averageRating) === null || _a === void 0 ? void 0 : _a.toFixed(2)) || "0"),
                    });
                }),
                topCategories: topCategories.map((cat) => {
                    var _a;
                    return ({
                        category: cat._id,
                        averageRating: parseFloat(((_a = cat.averageRating) === null || _a === void 0 ? void 0 : _a.toFixed(2)) || "0"),
                        reviewCount: cat.reviewCount,
                    });
                }),
            },
        });
    }
    catch (error) {
        console.error("Error in getRatingAnalytics:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: process.env.NODE_ENV === "development" ? error : {},
        });
    }
};
exports.getRatingAnalytics = getRatingAnalytics;
//# sourceMappingURL=ratingController.js.map