"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePromotionForMenuItem = exports.deletePromotion = exports.updatePromotion = exports.createPromotion = exports.getPromotionById = exports.getAllPromotions = void 0;
const PromotionService_1 = require("../services/PromotionService");
const Promotion_1 = __importDefault(require("../models/Promotion"));
const MenuItem_1 = __importDefault(require("@/models/MenuItem"));
const promotionService = new PromotionService_1.PromotionService();
const getAllPromotions = async (req, res) => {
    try {
        const { active } = req.query;
        let promotions;
        if (active === "true") {
            promotions = await promotionService.getActivePromotions();
        }
        else {
            promotions = await Promotion_1.default.find().populate("createdBy", "name email");
        }
        res.json(promotions);
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};
exports.getAllPromotions = getAllPromotions;
const getPromotionById = async (req, res) => {
    try {
        const promotion = await promotionService.getPromotionById(req.params.id);
        if (!promotion) {
            res.status(404).json({ message: "Promotion not found" });
            return;
        }
        res.json(promotion);
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};
exports.getPromotionById = getPromotionById;
const createPromotion = async (req, res) => {
    var _a;
    try {
        const promotionData = Object.assign(Object.assign({}, req.body), { createdBy: (_a = req.user) === null || _a === void 0 ? void 0 : _a._id });
        if (new Date(promotionData.startDate) >= new Date(promotionData.endDate)) {
            res.status(400).json({ message: "End date must be after start date" });
            return;
        }
        const promotion = await promotionService.createPromotion(promotionData);
        res.status(201).json(promotion);
    }
    catch (error) {
        if (error.code === 11000) {
            res
                .status(400)
                .json({ message: "Promotion with this name already exists" });
        }
        else {
            res
                .status(400)
                .json({ message: "Error creating promotion", error: error.message });
        }
    }
};
exports.createPromotion = createPromotion;
const updatePromotion = async (req, res) => {
    try {
        if (req.body.startDate && req.body.endDate) {
            if (new Date(req.body.startDate) >= new Date(req.body.endDate)) {
                res.status(400).json({ message: "End date must be after start date" });
                return;
            }
        }
        const promotion = await promotionService.updatePromotion(req.params.id, req.body);
        if (!promotion) {
            res.status(404).json({ message: "Promotion not found" });
            return;
        }
        res.json(promotion);
    }
    catch (error) {
        res
            .status(400)
            .json({ message: "Error updating promotion", error: error.message });
    }
};
exports.updatePromotion = updatePromotion;
const deletePromotion = async (req, res) => {
    try {
        const promotion = await promotionService.deletePromotion(req.params.id);
        if (!promotion) {
            res.status(404).json({ message: "Promotion not found" });
            return;
        }
        res.json({ message: "Promotion deactivated successfully", promotion });
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};
exports.deletePromotion = deletePromotion;
const validatePromotionForMenuItem = async (req, res) => {
    try {
        const menuItem = await MenuItem_1.default.findById(req.params.menuItemId);
        if (!menuItem) {
            res.status(404).json({ message: "Menu item not found" });
            return;
        }
        const promotion = await promotionService.computeBestPromotionForMenuItem(menuItem);
        res.json({
            applicable: !!promotion,
            promotion: promotion
                ? {
                    _id: promotion.promotion._id,
                    name: promotion.promotion.name,
                    discountType: promotion.promotion.discountType,
                    discountValue: promotion.promotion.discountValue,
                    discountAmount: promotion.discountAmount,
                    finalPrice: promotion.finalPrice,
                }
                : null,
        });
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};
exports.validatePromotionForMenuItem = validatePromotionForMenuItem;
//# sourceMappingURL=promotionController.js.map