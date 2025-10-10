"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMenu = exports.createMenu = exports.getMenuId = exports.getAllMenu = void 0;
const MenuItem_1 = __importDefault(require("../models/MenuItem"));
const getAllMenu = async (req, res) => {
    try {
        const { category, dietary, search, available, chefSpecial } = req.query;
        const filter = {};
        if (category)
            filter.category = category;
        if (dietary)
            filter.dietaryTags = dietary;
        if (available !== undefined)
            filter.availability = available === "true";
        if (chefSpecial !== undefined) {
            filter.chefSpecial = chefSpecial === "true";
        }
        if (search) {
            filter.$text = { $search: search };
        }
        const menuItems = await MenuItem_1.default.find(filter)
            .populate("category", "name")
            .sort({ name: 1 });
        res.json(menuItems);
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};
exports.getAllMenu = getAllMenu;
const getMenuId = async (req, res) => {
    try {
        const menuItem = await MenuItem_1.default.findById(req.params.id).populate("category", "name description");
        if (!menuItem) {
            res.status(404).json({ message: "Menu item not found" });
            return;
        }
        res.json(menuItem);
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};
exports.getMenuId = getMenuId;
const createMenu = async (req, res) => {
    try {
        const menuItem = new MenuItem_1.default(req.body);
        const savedItem = await menuItem.save();
        await savedItem.populate("category", "name");
        res.status(201).json(savedItem);
    }
    catch (error) {
        res.status(400).json({ message: "Error creating menu item", error });
    }
};
exports.createMenu = createMenu;
const updateMenu = async (req, res) => {
    try {
        const menuItem = await MenuItem_1.default.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        }).populate("category", "name");
        if (!menuItem) {
            res.status(404).json({ message: "Menu item not found" });
            return;
        }
        res.json(menuItem);
    }
    catch (error) {
        res.status(400).json({ message: "Error updating menu item", error });
    }
};
exports.updateMenu = updateMenu;
//# sourceMappingURL=menuController.js.map