import { LowStockNotificationRepository } from "../../repositories/low-stock-notification-repository";
import { LowStockNotification } from "../../models/low-stock-notification";
import { Result, ok, err } from "../../shared/result";

export class MockLowStockNotificationRepository implements LowStockNotificationRepository {
  private notifications: LowStockNotification[] = [];

  async create(
    notification: LowStockNotification,
  ): Promise<Result<LowStockNotification>> {
    this.notifications.push(notification);
    return ok(notification);
  }

  async findUnacknowledged(): Promise<Result<LowStockNotification[]>> {
    const unacknowledged = this.notifications.filter((n) => !n.acknowledged);
    return ok(unacknowledged);
  }

  async acknowledge(
    id: string,
    userId: string,
  ): Promise<Result<LowStockNotification>> {
    const notification = this.notifications.find((n) => n.id === id);
    if (!notification) {
      return err(new Error("Notification not found"));
    }

    // In a real implementation, we would update the notification
    const updatedNotification = {
      ...notification,
      acknowledged: true,
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
    };

    return ok(updatedNotification);
  }

  async findByIngredientId(
    ingredientId: string,
  ): Promise<Result<LowStockNotification | null>> {
    const notification = this.notifications.find(
      (n) => n.ingredientId === ingredientId && !n.acknowledged,
    );
    return ok(notification || null);
  }

  // Optional implementation
  async findRecentByIngredientId(
    ingredientId: string,
    hours: number,
  ): Promise<Result<LowStockNotification | null>> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const notification = this.notifications.find(
      (n) => n.ingredientId === ingredientId && n.notifiedAt > cutoff,
    );
    return ok(notification || null);
  }
}
