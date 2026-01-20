import { Result, ok } from "../shared/result";

export interface LowStockNotification {
  readonly id: string;
  readonly ingredientId: string;
  readonly ingredientName: string;
  readonly currentStock: number;
  readonly minStock: number;
  readonly notifiedAt: Date;
  readonly acknowledged: boolean;
  readonly acknowledgedBy?: string;
  readonly acknowledgedAt?: Date;
}

export class LowStockNotificationFactory {
  static create(
    id: string,
    ingredientId: string,
    ingredientName: string,
    currentStock: number,
    minStock: number,
    err: any,
  ): Result<LowStockNotification> {
    if (!ingredientId) {
      return err(new Error("Ingredient ID is required"));
    }
    if (!ingredientName) {
      return err(new Error("Ingredient name is required"));
    }
    if (currentStock < 0) {
      return err(new Error("Current stock cannot be negative"));
    }
    if (minStock < 0) {
      return err(new Error("Minimum stock cannot be negative"));
    }

    return ok({
      id,
      ingredientId,
      ingredientName,
      currentStock,
      minStock,
      notifiedAt: new Date(),
      acknowledged: false,
    });
  }
}
