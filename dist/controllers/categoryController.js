"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllCategory = void 0;
const Category_1 = __importDefault(require("../models/Category"));
const getAllCategory = async (req, res) => {
    try {
        const { name, isActive } = req.query;
        const filter = {};
        if (name) {
            filter.name = { $regex: name, $options: "i" };
        }
        if (isActive !== undefined) {
            filter.isActive = isActive === "true";
        }
        const categories = await Category_1.default.find(filter);
        res.json({
            success: true,
            count: categories.length,
            data: categories,
        });
    }
    catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getAllCategory = getAllCategory;
//# sourceMappingURL=categoryController.js.map