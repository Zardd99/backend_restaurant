import Promotion, { IPromotion } from "../models/Promotion";
import MenuItem, { IMenuItem } from "../models/MenuItem";
import { Types } from "mongoose";

export interface AppliedPromotion {
  promotion: IPromotion;
  discountAmount: number;
  finalPrice: number;
}

export class PromotionService {
  /**
   * Compute the best promotion for a given menu item at a given date (default now)
   */
  async computeBestPromotionForMenuItem(
    menuItem: IMenuItem,
    date: Date = new Date(),
  ): Promise<AppliedPromotion | null> {
    // Find all active promotions that are currently running
    const activePromotions = await Promotion.find({
      isActive: true,
      startDate: { $lte: date },
      endDate: { $gte: date },
    });

    let bestPromotion: AppliedPromotion | null = null;

    for (const promotion of activePromotions) {
      // Check if the promotion applies to the menu item
      if (await this.doesPromotionApply(promotion, menuItem)) {
        const discountAmount = this.calculateDiscountAmount(
          promotion,
          menuItem.price,
        );
        const finalPrice = menuItem.price - discountAmount;

        // Choose the promotion that gives the maximum discount (lowest final price)
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

  /**
   * Check if a promotion applies to a given menu item
   */
  private async doesPromotionApply(
    promotion: IPromotion,
    menuItem: IMenuItem,
  ): Promise<boolean> {
    if (promotion.appliesTo === "all") {
      return true;
    }

    const menuItemId = (menuItem._id as any).toString();
    const menuItemCategory = (menuItem.category as any).toString();

    if (promotion.appliesTo === "category") {
      // Check if the menu item's category is in the targetIds
      return promotion.targetIds.some(
        (targetId) => targetId.toString() === menuItemCategory,
      );
    }

    if (promotion.appliesTo === "menuItem") {
      // Check if the menu item's ID is in the targetIds
      return promotion.targetIds.some(
        (targetId) => targetId.toString() === menuItemId,
      );
    }

    return false;
  }

  /**
   * Calculate the discount amount for a given promotion and original price
   */
  private calculateDiscountAmount(
    promotion: IPromotion,
    originalPrice: number,
  ): number {
    if (promotion.discountType === "percentage") {
      return originalPrice * (promotion.discountValue / 100);
    } else {
      // fixed discount
      return Math.min(promotion.discountValue, originalPrice);
    }
  }

  /**
   * Get all active promotions (for admin panel, etc.)
   */
  async getActivePromotions(): Promise<IPromotion[]> {
    return Promotion.find({
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).populate("createdBy", "name email");
  }

  /**
   * Get promotion by ID
   */
  async getPromotionById(id: string): Promise<IPromotion | null> {
    return Promotion.findById(id).populate("createdBy", "name email");
  }

  /**
   * Create a new promotion
   */
  async createPromotion(promotionData: any): Promise<IPromotion> {
    const promotion = new Promotion(promotionData);
    return promotion.save();
  }

  /**
   * Update a promotion
   */
  async updatePromotion(
    id: string,
    updateData: any,
  ): Promise<IPromotion | null> {
    return Promotion.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
  }

  /**
   * Delete (deactivate) a promotion
   */
  async deletePromotion(id: string): Promise<IPromotion | null> {
    // Soft delete by setting isActive to false
    return Promotion.findByIdAndUpdate(id, { isActive: false }, { new: true });
  }
}
