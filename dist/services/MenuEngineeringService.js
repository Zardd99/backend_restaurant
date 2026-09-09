"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.menuEngineeringService = exports.MenuEngineeringService = void 0;
const Order_1 = __importDefault(require("../models/Order"));
const DEFAULT_WINDOW_DAYS = 30;
const round2 = (value) => Math.round(value * 100) / 100;
function median(values) {
    if (values.length === 0)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}
class MenuEngineeringService {
    async analyze(windowDays = DEFAULT_WINDOW_DAYS) {
        const safeWindow = Number.isFinite(windowDays) && windowDays > 0
            ? Math.floor(windowDays)
            : DEFAULT_WINDOW_DAYS;
        const cutoff = new Date(Date.now() - safeWindow * 24 * 60 * 60 * 1000);
        const rows = await Order_1.default.aggregate([
            { $match: { createdAt: { $gte: cutoff }, status: { $ne: "cancelled" } } },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.menuItem",
                    unitsSold: { $sum: "$items.quantity" },
                    revenue: {
                        $sum: {
                            $multiply: [
                                { $ifNull: ["$items.finalPrice", "$items.price"] },
                                "$items.quantity",
                            ],
                        },
                    },
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
                    name: "$menuItem.name",
                    unitsSold: 1,
                    revenue: 1,
                    baseCost: { $ifNull: ["$menuItem.costPrice", 0] },
                },
            },
        ]);
        const items = rows.map((row) => {
            const avgSalePrice = row.unitsSold > 0 ? row.revenue / row.unitsSold : 0;
            return {
                menuItemId: String(row._id),
                name: row.name,
                unitsSold: row.unitsSold,
                avgSalePrice: round2(avgSalePrice),
                baseCost: round2(row.baseCost),
                contributionMargin: round2(avgSalePrice - row.baseCost),
                quadrant: "dog",
            };
        });
        const medianPopularity = median(items.map((item) => item.unitsSold));
        const medianMargin = median(items.map((item) => item.contributionMargin));
        const quadrants = {
            star: [],
            plowhorse: [],
            puzzle: [],
            dog: [],
        };
        for (const item of items) {
            const popular = item.unitsSold >= medianPopularity;
            const profitable = item.contributionMargin >= medianMargin;
            item.quadrant = popular
                ? profitable
                    ? "star"
                    : "plowhorse"
                : profitable
                    ? "puzzle"
                    : "dog";
            quadrants[item.quadrant].push(item);
        }
        const scatter = items.map((item) => ({
            x: item.unitsSold,
            y: item.contributionMargin,
            label: item.name,
            quadrant: item.quadrant,
        }));
        return {
            generatedAt: new Date(),
            windowDays: safeWindow,
            medianPopularity: round2(medianPopularity),
            medianMargin: round2(medianMargin),
            items,
            quadrants,
            scatter,
        };
    }
}
exports.MenuEngineeringService = MenuEngineeringService;
exports.menuEngineeringService = new MenuEngineeringService();
//# sourceMappingURL=MenuEngineeringService.js.map