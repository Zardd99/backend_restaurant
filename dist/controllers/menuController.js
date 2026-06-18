"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMenuItem = exports.updateMenu = exports.createMenu = exports.getMenuId = exports.getAllMenu = void 0;
const MenuItem_1 = __importDefault(require("../models/MenuItem"));
const Category_1 = __importDefault(require("../models/Category"));
const PromotionService_1 = require("../services/PromotionService");
const enrichMenuItemsWithPromotions = async (menuItems) => {
    const promotionService = new PromotionService_1.PromotionService();
    const enrichedItems = await Promise.all(menuItems.map(async (item) => {
        var _a;
        const appliedPromo = await promotionService.computeBestPromotionForMenuItem(item);
        return Object.assign(Object.assign({}, item.toObject()), { effectivePrice: (_a = appliedPromo === null || appliedPromo === void 0 ? void 0 : appliedPromo.finalPrice) !== null && _a !== void 0 ? _a : item.price, originalPrice: item.price, appliedPromotion: appliedPromo
                ? {
                    id: appliedPromo.promotion._id,
                    name: appliedPromo.promotion.name,
                    discountType: appliedPromo.promotion.discountType,
                    discountValue: appliedPromo.promotion.discountValue,
                    discountAmount: appliedPromo.discountAmount,
                }
                : null });
    }));
    return enrichedItems;
};
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
        const enrichedItems = await enrichMenuItemsWithPromotions(menuItems);
        res.json(enrichedItems);
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
        const enrichedItems = await enrichMenuItemsWithPromotions([menuItem]);
        const enrichedItem = enrichedItems[0];
        res.json(enrichedItem);
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};
exports.getMenuId = getMenuId;
const createMenu = async (req, res) => {
    try {
        if (req.body.category && typeof req.body.category === "string") {
            let category = await Category_1.default.findOne({ name: req.body.category });
            if (!category) {
                category = new Category_1.default({ name: req.body.category });
                await category.save();
            }
            req.body.category = category._id;
        }
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
        if (req.body.category && typeof req.body.category === "string") {
            let category = await Category_1.default.findOne({ name: req.body.category });
            if (!category) {
                category = new Category_1.default({ name: req.body.category });
                await category.save();
            }
            req.body.category = category._id;
        }
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
const deleteMenuItem = async (req, res) => {
    try {
        const menuItem = await MenuItem_1.default.findByIdAndDelete(req.params.id);
        if (!menuItem) {
            res.status(404).json({ message: "Menu item not found" });
            return;
        }
        res.json({ message: "Menu item deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};
exports.deleteMenuItem = deleteMenuItem;
//# sourceMappingURL=menuController.js.map