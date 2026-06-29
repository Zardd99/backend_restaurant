import Order from "../models/Order";

export type MenuQuadrant = "star" | "plowhorse" | "puzzle" | "dog";

export interface MenuItemPerformance {
  menuItemId: string;
  name: string;
  unitsSold: number;
  avgSalePrice: number;
  baseCost: number;
  contributionMargin: number;
  quadrant: MenuQuadrant;
}

export interface ScatterPoint {
  x: number; // popularity (units sold)
  y: number; // contribution margin
  label: string;
  quadrant: MenuQuadrant;
}

export interface MenuEngineeringReport {
  generatedAt: Date;
  windowDays: number;
  medianPopularity: number;
  medianMargin: number;
  items: MenuItemPerformance[];
  quadrants: Record<MenuQuadrant, MenuItemPerformance[]>;
  scatter: ScatterPoint[];
}

interface AggregatedRow {
  _id: unknown;
  name: string;
  unitsSold: number;
  revenue: number;
  baseCost: number;
}

const DEFAULT_WINDOW_DAYS = 30;
const round2 = (value: number): number => Math.round(value * 100) / 100;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Boston Consulting Group menu-engineering matrix.
 *
 * Cross-tabulates each item's popularity (units sold) against its contribution
 * margin (average sale price − recipe base cost) over a trailing window, using
 * the per-axis medians as the split lines:
 *   Stars      high volume · high margin
 *   Plowhorses high volume · low  margin
 *   Puzzles    low  volume · high margin
 *   Dogs       low  volume · low  margin
 */
export class MenuEngineeringService {
  async analyze(
    windowDays: number = DEFAULT_WINDOW_DAYS,
  ): Promise<MenuEngineeringReport> {
    const safeWindow =
      Number.isFinite(windowDays) && windowDays > 0
        ? Math.floor(windowDays)
        : DEFAULT_WINDOW_DAYS;
    const cutoff = new Date(Date.now() - safeWindow * 24 * 60 * 60 * 1000);

    const rows = await Order.aggregate<AggregatedRow>([
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

    const items: MenuItemPerformance[] = rows.map((row) => {
      const avgSalePrice =
        row.unitsSold > 0 ? row.revenue / row.unitsSold : 0;
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

    const quadrants: Record<MenuQuadrant, MenuItemPerformance[]> = {
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

    const scatter: ScatterPoint[] = items.map((item) => ({
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

export const menuEngineeringService = new MenuEngineeringService();
