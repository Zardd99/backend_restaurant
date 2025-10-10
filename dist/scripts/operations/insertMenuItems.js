"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertMenuItems = void 0;
const baseOperation_1 = require("./baseOperation");
const MenuItem_1 = __importDefault(require("../../models/MenuItem"));
const menuItems_1 = require("../data/menuItems");
const validation_1 = require("../utils/validation");
const insertMenuItems = async (filePath, dataString) => {
    const operation = new InsertOperation();
    return await operation.execute(filePath, dataString);
};
exports.insertMenuItems = insertMenuItems;
class InsertOperation extends baseOperation_1.BaseOperation {
    constructor() {
        super("InsertOperation");
    }
    async execute(filePath, dataString) {
        return await this.executeOperation(async () => {
            let data;
            if (filePath) {
                data = await this.loadDataFromFile(filePath);
            }
            else if (dataString) {
                data = this.loadData(dataString, menuItems_1.menuItemsData);
            }
            else {
                data = menuItems_1.menuItemsData;
            }
            if (!data || data.length === 0) {
                const message = "No data provided for insertion";
                this.logger.warn(message);
                return {
                    success: false,
                    message,
                    data: null,
                };
            }
            (0, validation_1.validateMenuItems)(data);
            const { newItems, duplicates } = await this.filterDuplicates(data);
            if (duplicates.length > 0) {
                this.logger.warn(`Skipping ${duplicates.length} duplicate items`);
                duplicates.forEach((duplicate) => {
                    this.logger.debug(`Duplicate: ${duplicate.name}`);
                });
            }
            if (newItems.length === 0) {
                const message = "No new items to insert";
                this.logger.warn(message);
                return {
                    success: true,
                    message,
                    data: {
                        inserted: [],
                        skipped: duplicates,
                    },
                };
            }
            const result = await MenuItem_1.default.insertMany(newItems, { ordered: false });
            this.logger.info(`Inserted ${result.length} new menu items`);
            this.logger.info(`Skipped ${duplicates.length} duplicate items`);
            return {
                success: true,
                message: `Successfully inserted ${result.length} menu items`,
                data: {
                    inserted: result,
                    skipped: duplicates,
                },
            };
        });
    }
    async filterDuplicates(data) {
        return await (0, validation_1.checkForDuplicates)(data, MenuItem_1.default, "name");
    }
}
//# sourceMappingURL=insertMenuItems.js.map