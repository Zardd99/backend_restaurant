"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMenuItems = void 0;
const baseOperation_1 = require("./baseOperation");
const MenuItem_1 = __importDefault(require("../../models/MenuItem"));
const mongoose_1 = __importDefault(require("mongoose"));
const deleteMenuItems = async (filePath, id, name) => {
    const operation = new DeleteOperation();
    await operation.execute(filePath, id, name);
};
exports.deleteMenuItems = deleteMenuItems;
class DeleteOperation extends baseOperation_1.BaseOperation {
    constructor() {
        super("DeleteOperation");
    }
    async execute(filePath, id, name) {
        await this.executeOperation(async () => {
            if (filePath) {
                await this.deleteFromFile(filePath);
            }
            else if (id) {
                await this.deleteById(id);
            }
            else if (name) {
                await this.deleteByName(name);
            }
            else {
                this.logger.warn("No deletion criteria provided");
            }
        });
    }
    async deleteFromFile(filePath) {
        const data = await this.loadDataFromFile(filePath);
        if (data.length === 0) {
            this.logger.warn("No data provided for deletion");
            return;
        }
        const ids = data.map((item) => item._id).filter((id) => id);
        if (ids.length === 0) {
            this.logger.warn("No valid IDs found in the provided data");
            return;
        }
        const result = await MenuItem_1.default.deleteMany({ _id: { $in: ids } });
        this.logger.info(`Deleted ${result.deletedCount} menu items`);
    }
    async deleteById(id) {
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            throw new Error("Invalid ID format");
        }
        const result = await MenuItem_1.default.findByIdAndDelete(id);
        if (!result) {
            this.logger.warn(`Item with ID ${id} not found`);
        }
        else {
            this.logger.info(`Deleted menu item with ID: ${id}`);
        }
    }
    async deleteByName(name) {
        const result = await MenuItem_1.default.deleteMany({ name });
        this.logger.info(`Deleted ${result.deletedCount} menu items with name: ${name}`);
    }
}
//# sourceMappingURL=deleteMenuItems.js.map