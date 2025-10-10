"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryMenuItems = void 0;
const baseOperation_1 = require("./baseOperation");
const MenuItem_1 = __importDefault(require("../../models/MenuItem"));
const queryMenuItems = async (category, tag, available) => {
    const operation = new QueryOperation();
    await operation.execute(category, tag, available);
};
exports.queryMenuItems = queryMenuItems;
class QueryOperation extends baseOperation_1.BaseOperation {
    constructor() {
        super("QueryOperation");
    }
    async execute(category, tag, available) {
        await this.executeOperation(async () => {
            const filter = {};
            if (category) {
                filter.category = category;
            }
            if (tag) {
                filter.dietaryTags = tag;
            }
            if (available !== undefined) {
                filter.isAvailable = available;
            }
            const items = await MenuItem_1.default.find(filter);
            this.logger.info(`Found ${items.length} menu items`);
            console.log(JSON.stringify(items, null, 2));
            return items;
        });
    }
}
//# sourceMappingURL=queryMenuItems.js.map