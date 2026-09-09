"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderEventEmitter = exports.ORDER_CREATED = void 0;
const events_1 = require("events");
const mongoose_1 = require("mongoose");
const dependencies_1 = require("../../config/dependencies");
const MenuItem_1 = __importDefault(require("../../models/MenuItem"));
exports.ORDER_CREATED = "order.created";
class OrderEventEmitter extends events_1.EventEmitter {
}
exports.orderEventEmitter = new OrderEventEmitter();
exports.orderEventEmitter.on("error", (error) => {
    console.error("orderEventEmitter error:", error);
});
const STATION_KEYWORDS = [
    ["grill", /grill|steak|burger|bbq|kebab|skewer|chop|roast/i],
    ["fry", /fry|fried|fries|tempura|wing|nugget|crispy|katsu/i],
    ["pantry", /salad|dessert|drink|beverage|juice|cold|ice cream|smoothie/i],
];
function inferStation(name, categoryName) {
    const haystack = `${name} ${categoryName}`;
    for (const [station, pattern] of STATION_KEYWORDS) {
        if (pattern.test(haystack))
            return station;
    }
    return "prep";
}
async function buildPaceItems(items) {
    var _a, _b, _c;
    const menuItemIds = items.map((item) => String(item.menuItem));
    const menuItems = await MenuItem_1.default.find({ _id: { $in: menuItemIds } })
        .populate("category", "name")
        .lean();
    const byId = new Map(menuItems.map((mi) => [String(mi._id), mi]));
    const paceItems = [];
    for (const item of items) {
        const menuItem = byId.get(String(item.menuItem));
        if (!menuItem)
            continue;
        const categoryName = (_b = (_a = menuItem.category) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : "";
        paceItems.push({
            itemId: item._id ? String(item._id) : new mongoose_1.Types.ObjectId().toString(),
            name: menuItem.name,
            station: inferStation(menuItem.name, categoryName),
            cookTimeMinutes: (_c = menuItem.preparationTime) !== null && _c !== void 0 ? _c : 15,
        });
    }
    return paceItems;
}
exports.orderEventEmitter.on(exports.ORDER_CREATED, (payload) => {
    void (async () => {
        var _a;
        try {
            const items = await buildPaceItems((_a = payload.items) !== null && _a !== void 0 ? _a : []);
            if (items.length === 0)
                return;
            const kdsPacingService = dependencies_1.DependencyContainer.getInstance().resolve("KdsPacingService");
            await kdsPacingService.paveTicket(payload.orderId, items);
        }
        catch (error) {
            console.error(`Failed to pave KDS ticket for order ${payload === null || payload === void 0 ? void 0 : payload.orderId}:`, error);
        }
    })();
});
//# sourceMappingURL=order-events.js.map