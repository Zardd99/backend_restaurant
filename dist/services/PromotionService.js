"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromotionService = void 0;
const Promotion_1 = __importDefault(require("../models/Promotion"));
class PromotionService {
    async computeBestPromotionForMenuItem(menuItem, date = new Date()) {
        const activePromotions = await Promotion_1.default.find({
            isActive: true,
            startDate: { $lte: date },
            endDate: { $gte: date },
        });
        let bestPromotion = null;
        for (const promotion of activePromotions) {
            if (await this.doesPromotionApply(promotion, menuItem)) {
                const discountAmount = this.calculateDiscountAmount(promotion, menuItem.price);
                const finalPrice = menuItem.price - discountAmount;
                if (!bestPromotion || finalPrice < bestPromotion.finalPrice) {
                    bestPromotion = {
                        promotion,
                        discountAmount,
                        finalPrice,
                    };
                }
            }
        }
        return bestPromotion;
    }
    async doesPromotionApply(promotion, menuItem) {
        if (promotion.appliesTo === "all") {
            return true;
        }
        const menuItemId = menuItem._id.toString();
        const menuItemCategory = menuItem.category.toString();
        if (promotion.appliesTo === "category") {
            return promotion.targetIds.some((targetId) => targetId.toString() === menuItemCategory);
        }
        if (promotion.appliesTo === "menuItem") {
            return promotion.targetIds.some((targetId) => targetId.toString() === menuItemId);
        }
        return false;
    }
    calculateDiscountAmount(promotion, originalPrice) {
        if (promotion.discountType === "percentage") {
            return originalPrice * (promotion.discountValue / 100);
        }
        else {
            return Math.min(promotion.discountValue, originalPrice);
        }
    }
    async getActivePromotions() {
        return Promotion_1.default.find({
            isActive: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
        }).populate("createdBy", "name email");
    }
    async getPromotionById(id) {
        return Promotion_1.default.findById(id).populate("createdBy", "name email");
    }
    async createPromotion(promotionData) {
        const promotion = new Promotion_1.default(promotionData);
        return promotion.save();
    }
    async updatePromotion(id, updateData) {
        return Promotion_1.default.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });
    }
    async deletePromotion(id) {
        return Promotion_1.default.findByIdAndUpdate(id, { isActive: false }, { new: true });
    }
}
exports.PromotionService = PromotionService;
//# sourceMappingURL=PromotionService.js.map