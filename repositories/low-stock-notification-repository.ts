import { LowStockNotification } from "../models/low-stock-notification";
import { Result } from "../shared/result";

export interface LowStockNotificationRepository {
  create(
    notification: LowStockNotification,
  ): Promise<Result<LowStockNotification>>;
  findUnacknowledged(): Promise<Result<LowStockNotification[]>>;
  acknowledge(
    id: string,
    userId: string,
  ): Promise<Result<LowStockNotification>>;
  findByIngredientId(
    ingredientId: string,
  ): Promise<Result<LowStockNotification | null>>;
}
