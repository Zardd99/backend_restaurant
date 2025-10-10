"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMenuItems = void 0;
const baseOperation_1 = require("./baseOperation");
const MenuItem_1 = __importDefault(require("../../models/MenuItem"));
const validation_1 = require("../utils/validation");
const menuItems_1 = require("../data/menuItems");
const updateMenuItems = async (filePath, dataString) => {
    const operation = new UpdateOperation();
    await operation.execute(filePath, dataString);
};
exports.updateMenuItems = updateMenuItems;
class UpdateOperation extends baseOperation_1.BaseOperation {
    constructor() {
        super("UpdateOperation");
    }
    async execute(filePath, dataString) {
        await this.executeOperation(async () => {
            let data;
            if (filePath) {
                data = await this.loadDataFromFile(filePath);
            }
            else {
                data = this.loadData(dataString, menuItems_1.menuItemsData);
            }
            if (data.length === 0) {
                this.logger.warn("No data provided for update");
                return;
            }
            (0, validation_1.validateMenuItems)(data);
            const updateOperations = data.map(async (item) => {
                if (!item.name) {
                    throw new Error("Missing name field for update operation");
                }
                const { name } = item, updateData = __rest(item, ["name"]);
                const result = await MenuItem_1.default.findByIdAndUpdate(name, { $set: updateData }, { new: true, runValidators: true });
                if (!result) {
                    this.logger.warn(`Item with ID ${name} not found`);
                }
                return result;
            });
            const results = await Promise.all(updateOperations);
            const successfulUpdates = results.filter((result) => result !== null);
            this.logger.info(`Updated ${successfulUpdates.length} menu items`);
            return successfulUpdates;
        });
    }
}
//# sourceMappingURL=updateMenuItems.js.map